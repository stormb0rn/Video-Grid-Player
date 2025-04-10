// Supabase 配置
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// 存储桶名称
const STORAGE_BUCKET = 'videos';

// 数据库表名
const RECORDS_TABLE = 'video_records';

// 导出配置
window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    storageBucket: STORAGE_BUCKET,
    recordsTable: RECORDS_TABLE
}; 