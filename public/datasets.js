document.addEventListener('DOMContentLoaded', async () => {
    // --- Supabase Client Initialization ---
    const { createClient } = supabase;
    const supabaseClient = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    const BUCKET_NAME = window.SUPABASE_CONFIG.storageBucket;

    if (!supabaseClient) {
        console.error('Supabase client not found. Make sure config.js is loaded and configured correctly.');
        showToast('Supabase 配置错误', 'error');
        return;
    }

    // --- State Management ---
    let currentSelectedDatasetId = null;

    // --- Element Caching ---
    const datasetList = document.getElementById('datasetList');
    const addDatasetBtn = document.getElementById('addDatasetBtn');
    const createDatasetModal = document.getElementById('createDatasetModal');
    const confirmCreateBtn = document.getElementById('confirmCreateBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const newDatasetNameInput = document.getElementById('newDatasetName');
    const currentDatasetName = document.getElementById('currentDatasetName');
    const deleteDatasetBtn = document.getElementById('deleteDatasetBtn');
    const datasetContent = document.getElementById('datasetContent');
    const videoList = document.getElementById('videoList');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const fileInput = document.getElementById('fileInput');
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const renameDatasetBtn = document.getElementById('renameDatasetBtn');
    const renameDatasetModal = document.getElementById('renameDatasetModal');
    const confirmRenameBtn = document.getElementById('confirmRenameBtn');
    const cancelRenameBtn = document.getElementById('cancelRenameBtn');
    const renameDatasetNameInput = document.getElementById('renameDatasetName');

    // --- Toast Notification ---
    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    }

    // --- Modal Logic ---
    function openModal() {
        newDatasetNameInput.value = '';
        createDatasetModal.classList.remove('hidden');
        newDatasetNameInput.focus();
    }

    function closeModal() {
        createDatasetModal.classList.add('hidden');
    }

    addDatasetBtn.addEventListener('click', openModal);
    cancelCreateBtn.addEventListener('click', closeModal);
    createDatasetModal.querySelector('.close-button').addEventListener('click', closeModal);

    function openRenameModal() {
        if (!currentSelectedDatasetId) return;
        renameDatasetNameInput.value = currentDatasetName.textContent;
        renameDatasetModal.classList.remove('hidden');
        renameDatasetNameInput.focus();
    }

    function closeRenameModal() {
        renameDatasetModal.classList.add('hidden');
    }

    renameDatasetBtn.addEventListener('click', openRenameModal);
    cancelRenameBtn.addEventListener('click', closeRenameModal);
    renameDatasetModal.querySelector('.close-button').addEventListener('click', closeRenameModal);

    // --- Data Fetching and Rendering ---
    async function loadDatasets() {
        datasetList.innerHTML = '<li>加载中...</li>';
        try {
            const { data: datasets, error } = await supabaseClient
                .from('datasets')
                .select('id, name')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            datasetList.innerHTML = '';
            if (datasets.length === 0) {
                datasetList.innerHTML = '<li class="text-gray-500">没有数据集</li>';
                updateRightPanelAsEmpty();
                return;
            }

            datasets.forEach(dataset => {
                const li = document.createElement('li');
                li.className = 'p-2 rounded-md hover:bg-gray-700 cursor-pointer';
                li.textContent = dataset.name;
                li.dataset.id = dataset.id;
                datasetList.appendChild(li);
            });
        } catch (error) {
            console.error('Error loading datasets:', error);
            showToast('加载数据集列表失败', 'error');
            datasetList.innerHTML = '<li>加载失败</li>';
        }
    }

    async function loadVideosForDataset(datasetId) {
        videoList.innerHTML = '<li>加载中...</li>';
        try {
            const { data: videos, error } = await supabaseClient
                .from('videos')
                .select('id, file_name, public_url, storage_path')
                .eq('dataset_id', datasetId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            videoList.innerHTML = '';
            if (videos.length > 0) {
                // Button group container
                const btnGroup = document.createElement('div');
                btnGroup.className = 'flex gap-2 mb-4';

                const openInPlayerBtn = document.createElement('button');
                openInPlayerBtn.textContent = '在播放器中打开';
                openInPlayerBtn.className = 'button-style flex-grow';
                openInPlayerBtn.onclick = () => {
                     window.location.href = `player.html?dataset=${datasetId}`;
                };
                btnGroup.appendChild(openInPlayerBtn);

                const compareWithBtn = document.createElement('button');
                compareWithBtn.textContent = '与其他数据集对比';
                compareWithBtn.className = 'button-style-secondary';
                compareWithBtn.onclick = () => openCompareSelector(datasetId);
                btnGroup.appendChild(compareWithBtn);

                videoList.insertBefore(btnGroup, videoList.firstChild);
            }
           
            videos.forEach(video => {
                const li = document.createElement('li');
                li.className = 'video-list-item';
                const a = document.createElement('a');
                a.href = video.public_url;
                a.textContent = video.file_name;
                a.target = '_blank';
                a.className = 'hover:text-blue-400';

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '删除';
                deleteBtn.className = 'text-red-500 hover:text-red-400 text-sm';
                deleteBtn.onclick = () => handleDeleteVideo(video.id, video.storage_path, video.file_name);

                li.appendChild(a);
                li.appendChild(deleteBtn);
                videoList.appendChild(li);
            });
        } catch (error) {
            console.error(`Error loading videos for dataset ${datasetId}:`, error);
            showToast('加载视频列表失败', 'error');
        }
    }

    // --- UI State Updates ---
    function updateRightPanelAsEmpty() {
        currentDatasetName.textContent = '请选择或创建一个数据集';
        deleteDatasetBtn.disabled = true;
        renameDatasetBtn.disabled = true;
        datasetContent.classList.add('hidden');
    }

    function updateRightPanelForDataset(dataset) {
        currentSelectedDatasetId = dataset.id;
        currentDatasetName.textContent = dataset.name;
        deleteDatasetBtn.disabled = false;
        renameDatasetBtn.disabled = false;
        datasetContent.classList.remove('hidden');
        fileUploadContainer.classList.remove('hidden');
        loadVideosForDataset(dataset.id);
    }

    // --- Event Handlers ---
    datasetList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI' && e.target.dataset.id) {
            const allItems = datasetList.querySelectorAll('li');
            allItems.forEach(li => li.classList.remove('bg-blue-600'));
            e.target.classList.add('bg-blue-600');
            
            const dataset = {
                id: e.target.dataset.id,
                name: e.target.textContent
            };
            updateRightPanelForDataset(dataset);
        }
    });

    async function handleCreateDataset() {
        const newName = newDatasetNameInput.value.trim();
        if (!newName) {
            showToast('数据集名称不能为空', 'warning');
            return;
        }
        confirmCreateBtn.disabled = true;
        confirmCreateBtn.textContent = '创建中...';

        try {
            const { data, error } = await supabaseClient
                .from('datasets')
                .insert({ name: newName })
                .select()
                .single();

            if (error) throw error;
            
            showToast(`数据集 "${newName}" 创建成功`, 'success');
            closeModal();
            await loadDatasets();
            
            // Auto-select the new dataset
            const newItem = datasetList.querySelector(`[data-id="${data.id}"]`);
            if (newItem) {
                newItem.click();
            }

        } catch (error) {
            console.error('Error creating dataset:', error);
            showToast(`创建失败: ${error.message}`, 'error');
        } finally {
            confirmCreateBtn.disabled = false;
            confirmCreateBtn.textContent = '创建';
        }
    }

    confirmCreateBtn.addEventListener('click', handleCreateDataset);
    newDatasetNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleCreateDataset();
    });

    async function handleDeleteVideo(videoId, storagePath, fileName) {
        if (!confirm(`确定要删除视频 "${fileName}" 吗？`)) return;

        try {
            // 1. Delete file from storage
            const { error: storageError } = await supabaseClient.storage.from(BUCKET_NAME).remove([storagePath]);
            if (storageError) throw storageError;

            // 2. Delete video record from database
            const { error: dbError } = await supabaseClient.from('videos').delete().eq('id', videoId);
            if (dbError) throw dbError;

            showToast(`视频 "${fileName}" 已删除`, 'success');
            loadVideosForDataset(currentSelectedDatasetId);

        } catch (error) {
            console.error('Error deleting video:', error);
            showToast(`删除视频失败: ${error.message}`, 'error');
        }
    }

    deleteDatasetBtn.addEventListener('click', async () => {
        if (!currentSelectedDatasetId) return;
        
        const datasetName = currentDatasetName.textContent;
        if (!confirm(`确定要删除数据集 "${datasetName}" 吗？\n警告：所有关联的视频文件将从云端被永久删除！`)) {
            return;
        }

        try {
            // 1. Get all video files to delete from storage
            const { data: videos, error: videoError } = await supabaseClient
                .from('videos')
                .select('storage_path')
                .eq('dataset_id', currentSelectedDatasetId);
            
            if (videoError) throw videoError;

            // 2. Delete files from Supabase Storage
            if (videos.length > 0) {
                const filePaths = videos.map(v => v.storage_path);
                const { error: storageError } = await supabaseClient.storage.from(BUCKET_NAME).remove(filePaths);
                if (storageError) throw storageError;
            }

            // 3. Delete dataset record from database (relies on cascade delete for videos table)
            const { error: dbError } = await supabaseClient
                .from('datasets')
                .delete()
                .eq('id', currentSelectedDatasetId);

            if (dbError) throw dbError;

            showToast(`数据集 "${datasetName}" 已成功删除`, 'success');
            currentSelectedDatasetId = null;
            await loadDatasets();
            
        } catch (error) {
            console.error('Error deleting dataset:', error);
            showToast(`删除失败: ${error.message}`, 'error');
        }
    });

    // --- File Upload Logic ---
    browseFilesBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
            fileInput.value = ''; // Reset so same folder can be re-selected
        }
    });
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUploadContainer.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    fileUploadContainer.addEventListener('drop', async (e) => {
        const items = e.dataTransfer.items;
        if (items) {
            await handleDroppedItems(items);
        } else {
            await handleFiles(e.dataTransfer.files);
        }
    });

    async function handleDroppedItems(items) {
        if (!currentSelectedDatasetId) {
            showToast('请先选择一个数据集', 'warning');
            return;
        }

        const files = [];
        const entries = [];

        // Convert items to entries
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    entries.push(entry);
                }
            }
        }

        // Recursively read all files from entries (including folders)
        async function readEntry(entry, path = '') {
            if (entry.isFile) {
                return new Promise((resolve, reject) => {
                    entry.file((file) => {
                        // Create a new file with path information
                        const fileWithPath = new File([file], file.name, { type: file.type });
                        fileWithPath.relativePath = path + file.name;
                        files.push(fileWithPath);
                        resolve();
                    }, reject);
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();

                // Read all entries in directory (handle pagination)
                async function readAllEntries() {
                    const allEntries = [];

                    async function readBatch() {
                        return new Promise((resolve, reject) => {
                            dirReader.readEntries((entries) => {
                                if (entries.length > 0) {
                                    allEntries.push(...entries);
                                    readBatch().then(resolve, reject);
                                } else {
                                    resolve(allEntries);
                                }
                            }, reject);
                        });
                    }

                    return readBatch();
                }

                const entries = await readAllEntries();
                for (const childEntry of entries) {
                    await readEntry(childEntry, path + entry.name + '/');
                }
            }
        }

        // Read all entries
        for (const entry of entries) {
            await readEntry(entry);
        }

        if (files.length === 0) {
            showToast('没有找到可上传的文件', 'warning');
            return;
        }

        showToast(`找到 ${files.length} 个文件，开始上传...`, 'info');

        for (const file of files) {
            await uploadFile(file);
        }

        showToast('所有文件上传完毕!', 'success');
        await loadVideosForDataset(currentSelectedDatasetId);
    }

    async function handleFiles(files) {
        if (!currentSelectedDatasetId) {
            showToast('请先选择一个数据集', 'warning');
            return;
        }
        if (files.length === 0) return;

        const fileArray = Array.from(files);
        showToast(`开始上传 ${fileArray.length} 个文件...`);

        for (const file of fileArray) {
            await uploadFile(file);
        }

        showToast('所有文件上传完毕!', 'success');
        await loadVideosForDataset(currentSelectedDatasetId);
    }
    
    async function uploadFile(file) {
        const filePath = `${currentSelectedDatasetId}/${file.name}`;
        let uploadToast = showToast(`正在上传: ${file.name}`, 'info', 10000); // long duration

        try {
            // Upload to storage
            const { error: uploadError } = await supabaseClient.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);

            if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

            // Get public URL
            const { data: { publicUrl } } = supabaseClient.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            // Insert into 'videos' table
            const { error: dbError } = await supabaseClient
                .from('videos')
                .insert({
                    dataset_id: currentSelectedDatasetId,
                    file_name: file.name,
                    storage_path: filePath,
                    public_url: publicUrl
                });
            
            if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);
            
            showToast(`上传成功: ${file.name}`, 'success');

        } catch (error) {
            console.error(`Error uploading ${file.name}:`, error);
            showToast(`上传失败: ${file.name} - ${error.message}`, 'error');
        }
    }

    async function handleRenameDataset() {
        const newName = renameDatasetNameInput.value.trim();
        if (!newName) {
            showToast('新名称不能为空', 'warning');
            return;
        }
        confirmRenameBtn.disabled = true;
        confirmRenameBtn.textContent = '重命名中...';
        try {
            const { error } = await supabaseClient
                .from('datasets')
                .update({ name: newName })
                .eq('id', currentSelectedDatasetId);
            if (error) throw error;
            showToast('重命名成功', 'success');
            closeRenameModal();
            await loadDatasets();
            // 自动选中重命名后的数据集
            const newItem = datasetList.querySelector(`[data-id="${currentSelectedDatasetId}"]`);
            if (newItem) newItem.click();
        } catch (error) {
            console.error('Error renaming dataset:', error);
            showToast(`重命名失败: ${error.message}`, 'error');
        } finally {
            confirmRenameBtn.disabled = false;
            confirmRenameBtn.textContent = '确定';
        }
    }

    confirmRenameBtn.addEventListener('click', handleRenameDataset);
    renameDatasetNameInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleRenameDataset();
    });

    // --- Compare Selector Modal ---
    const compareSelectModal = document.getElementById('compareSelectModal');
    const compareTargetSelect = document.getElementById('compareTargetSelect');
    const confirmCompareBtn = document.getElementById('confirmCompareBtn');
    const cancelCompareBtn = document.getElementById('cancelCompareBtn');
    let compareBaseId = null;

    cancelCompareBtn.addEventListener('click', () => compareSelectModal.classList.add('hidden'));
    compareSelectModal.querySelector('.close-button').addEventListener('click', () => compareSelectModal.classList.add('hidden'));

    confirmCompareBtn.addEventListener('click', () => {
        const targetId = compareTargetSelect.value;
        if (!targetId || !compareBaseId) return;
        window.location.href = `player.html?dataset=${compareBaseId}&compare=${targetId}`;
    });

    async function openCompareSelector(baseDatasetId) {
        compareBaseId = baseDatasetId;
        try {
            const { data: datasets, error } = await supabaseClient
                .from('datasets')
                .select('id, name')
                .neq('id', baseDatasetId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            if (datasets.length === 0) {
                showToast('没有其他数据集可以对比', 'warning');
                return;
            }

            compareTargetSelect.innerHTML = '';
            datasets.forEach(ds => {
                const option = document.createElement('option');
                option.value = ds.id;
                option.textContent = ds.name;
                compareTargetSelect.appendChild(option);
            });

            compareSelectModal.classList.remove('hidden');
        } catch (err) {
            console.error('Compare selector error:', err);
            showToast('加载数据集列表失败', 'error');
        }
    }

    // --- Initial Load ---
    loadDatasets();
    updateRightPanelAsEmpty();
}); 