import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- Test Configuration ---
const TEST_TIMEOUT = 30000; // 30 seconds

// --- Helper Functions ---
const log = (message, type = 'info') => {
    const colorMap = {
        info: '\x1b[34m', // Blue
        success: '\x1b[32m', // Green
        error: '\x1b[31m', // Red
        warn: '\x1b[33m', // Yellow
        reset: '\x1b[0m'
    };
    console.log(`${colorMap[type] || ''}[${type.toUpperCase()}] ${message}${colorMap.reset}`);
};

const getConfig = () => {
    try {
        const configStr = fs.readFileSync(path.resolve(process.cwd(), 'public/config.js'), 'utf-8');
        const urlMatch = configStr.match(/url:\s*'([^']+)'/);
        const anonKeyMatch = configStr.match(/anonKey:\s*'([^']+)'/);
        const storageBucketMatch = configStr.match(/storageBucket:\s*'([^']+)'/);

        if (!urlMatch || !anonKeyMatch || !storageBucketMatch) {
            throw new Error('无法从 public/config.js 解析配置。');
        }
        return {
            url: urlMatch[1],
            anonKey: anonKeyMatch[1],
            storageBucket: storageBucketMatch[1],
        };
    } catch (error) {
        log('读取配置文件失败。', 'error');
        throw error;
    }
};

// --- Test Runner ---
async function runTests() {
    const config = getConfig();
    const supabase = createClient(config.url, config.anonKey);
    const testDatasetName = `test-dataset-${Date.now()}`;
    let testDatasetId = null;
    const mockFileName = `test-file-${Date.now()}.txt`;
    const mockFileContent = 'This is an automated test file.';
    const mockStoragePath = `public/${mockFileName}`;

    log('开始核心功能测试...');

    try {
        // 1. 创建数据集
        log(`步骤 1/5: 正在创建测试数据集 "${testDatasetName}"...`);
        const { data: createData, error: createError } = await supabase
            .from('datasets')
            .insert({ name: testDatasetName })
            .select()
            .single();
        if (createError) throw new Error(`创建数据集失败: ${createError.message}`);
        testDatasetId = createData.id;
        log('✅ 数据集创建成功。', 'success');

        // 2. 验证数据集
        log(`步骤 2/5: 正在验证数据集 (ID: ${testDatasetId})...`);
        const { data: fetchData, error: fetchError } = await supabase
            .from('datasets')
            .select('name')
            .eq('id', testDatasetId)
            .single();
        if (fetchError) throw new Error(`验证数据集失败: ${fetchError.message}`);
        if (fetchData.name !== testDatasetName) throw new Error('验证失败：数据集名称不匹配。');
        log('✅ 数据集验证成功。', 'success');

        // 3. 上传文件
        log(`步骤 3/5: 正在上传测试文件到存储桶 "${config.storageBucket}"...`);
        const { error: uploadError } = await supabase.storage
            .from(config.storageBucket)
            .upload(mockStoragePath, mockFileContent);
        if (uploadError) throw new Error(`上传文件失败: ${uploadError.message}`);
        log('✅ 文件上传成功。', 'success');

        // 4. 验证文件记录（模拟）
        log(`步骤 4/5: 正在创建视频记录以链接文件...`);
        const { data: videoData, error: videoError } = await supabase
            .from('videos')
            .insert({
                dataset_id: testDatasetId,
                file_name: mockFileName,
                storage_path: mockStoragePath,
                public_url: 'http://example.com/test.mp4' // The public URL isn't critical for this test
            })
            .select();
        if (videoError) throw new Error(`创建视频记录失败: ${videoError.message}`);
        if (!videoData || videoData.length === 0) throw new Error('视频记录未成功创建。');
        log('✅ 视频记录创建成功。', 'success');

        // 5. 清理
        log(`步骤 5/5: 正在清理测试数据...`);
        // 删除文件
        const { error: removeError } = await supabase.storage
            .from(config.storageBucket)
            .remove([mockStoragePath]);
        if (removeError) log(`文件清理警告: ${removeError.message}`, 'warn');
        else log('  - 测试文件已从存储中删除。', 'success');
        
        // 删除数据集 (级联删除视频记录)
        const { error: deleteError } = await supabase
            .from('datasets')
            .delete()
            .eq('id', testDatasetId);
        if (deleteError) throw new Error(`数据集清理失败: ${deleteError.message}`);
        log('  - 测试数据集已删除。', 'success');
        
        log('✅ 清理完成。', 'success');
        log('\n🎉 所有核心功能测试通过！', 'success');
        return true;

    } catch (error) {
        log(`\n❌ 测试失败: ${error.message}`, 'error');
        // 如果测试失败，尝试进行清理
        if (testDatasetId) {
            log('正在尝试清理失败的测试...', 'warn');
            await supabase.storage.from(config.storageBucket).remove([mockStoragePath]);
            await supabase.from('datasets').delete().eq('id', testDatasetId);
            log('尽力清理完成。', 'warn');
        }
        return false;
    }
}

// --- Main Execution ---
const timeout = setTimeout(() => {
    log('测试超时！', 'error');
    process.exit(1);
}, TEST_TIMEOUT);

runTests().then(success => {
    clearTimeout(timeout);
    process.exit(success ? 0 : 1);
}); 