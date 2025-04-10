const dropZone = document.getElementById('dropZone');
let videoGrid; // 将在DOMContentLoaded中获取
const currentCount = document.getElementById('currentCount');
const MAX_VIDEOS = 1000;
const downloadAllButton = document.getElementById('downloadAll');
const folderSelectButton = document.getElementById('folderSelect');
const statusText = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Show animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    // Remove element
    setTimeout(() => {
      toast.remove();
    }, 300); // Wait for fade out animation
  }, duration);
  
  // Log to console
  console.log(`Toast (${type}):`, message);
}

// Set status text
function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? '#ef4444' : '#9ca3af';
  console.log(isError ? 'Error: ' : 'Status: ', message);
}

// Supported media types
const SUPPORTED_TYPES = {
  video: ['video/'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
};

// 添加新的常量
// 截图相关常量
const SCREENSHOT_BUTTON_TEXT = '📷 截图';
const SCREENSHOT_ALL_BUTTON_TEXT = '📷 截取所有视频';
const SCREENSHOT_FILENAME_PREFIX = 'video_screenshot_';

// 用于存储文件树结构
let fileTreeStructure = null;

// 全局变量，用于跟踪当前过滤状态
let currentFilterPath = null;

// 存储原始视频布局，用于在取消过滤时恢复
window.originalVideoLayout = null;

// Initialize Supabase client
const supabase = supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);

// Get DOM elements
const uploadButton = document.getElementById('uploadButton');
const recordsButton = document.getElementById('recordsButton');
const recordsModal = document.getElementById('recordsModal');
const uploadModal = document.getElementById('uploadModal');
const recordsList = document.querySelector('.records-list');
const uploadProgress = document.querySelector('.progress-fill');
const uploadProgressText = document.querySelector('.progress-text');
const uploadStatus = document.querySelector('.upload-status');

// Close modal buttons
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', () => {
        recordsModal.classList.remove('show');
        uploadModal.classList.remove('show');
    });
});

// Click outside to close modal
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// Upload button click event
uploadButton.addEventListener('click', async () => {
    const containers = document.querySelectorAll('.video-container');
    if (containers.length === 0) {
        showToast('没有可上传的媒体文件', 'info');
        return;
    }
    
    uploadModal.classList.add('show');
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        const video = container.querySelector('video');
        const img = container.querySelector('img.image-preview');
        const filename = container.querySelector('.video-filename').textContent;
        
        try {
            // Update progress
            const progress = ((i + 1) / containers.length) * 100;
            uploadProgress.style.width = `${progress}%`;
            uploadProgressText.textContent = `${Math.round(progress)}%`;
            uploadStatus.textContent = `正在上传: ${filename}`;
            
            // Get file data
            let fileData;
            if (video) {
                fileData = await fetch(video.src).then(r => r.blob());
            } else if (img) {
                fileData = await fetch(img.src).then(r => r.blob());
            }
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(window.SUPABASE_CONFIG.storageBucket)
                .upload(`${Date.now()}_${filename}`, fileData);
            
            if (uploadError) throw uploadError;
            
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from(window.SUPABASE_CONFIG.storageBucket)
                .getPublicUrl(uploadData.path);
            
            // Save record to database
            const { error: dbError } = await supabase
                .from(window.SUPABASE_CONFIG.recordsTable)
                .insert([
                    {
                        name: filename,
                        url: publicUrl,
                        path: uploadData.path,
                        type: video ? 'video' : 'image'
                    }
                ]);
            
            if (dbError) throw dbError;
            
            successCount++;
        } catch (error) {
            console.error('上传失败:', error);
            failCount++;
        }
    }
    
    // Show result
    uploadStatus.textContent = `上传完成: ${successCount} 个成功, ${failCount} 个失败`;
    showToast(`上传完成: ${successCount} 个成功, ${failCount} 个失败`, successCount > 0 ? 'success' : 'error');
    
    // 3 seconds later close modal
    setTimeout(() => {
        uploadModal.classList.remove('show');
    }, 3000);
});

// Records button click event
recordsButton.addEventListener('click', async () => {
    recordsModal.classList.add('show');
    await loadRecords();
});

// Load records list
async function loadRecords() {
    try {
        const { data: records, error } = await supabase
            .from(window.SUPABASE_CONFIG.recordsTable)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        recordsList.innerHTML = records.map(record => `
            <div class="record-item" data-id="${record.id}">
                <div class="record-info">
                    <div class="record-name">${record.name}</div>
                    <div class="record-url">${record.url}</div>
                </div>
                <div class="record-actions">
                    <button class="record-button copy" onclick="copyUrl('${record.url}')">复制链接</button>
                    <button class="record-button edit" onclick="editRecord(${record.id}, '${record.name}')">重命名</button>
                    <button class="record-button delete" onclick="deleteRecord(${record.id})">删除</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载记录失败:', error);
        showToast('加载记录失败', 'error');
    }
}

// Copy URL
async function copyUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        showToast('链接已复制到剪贴板', 'success');
    } catch (error) {
        console.error('复制失败:', error);
        showToast('复制失败', 'error');
    }
}

// Edit record
async function editRecord(id, currentName) {
    const newName = prompt('请输入新的名称:', currentName);
    if (!newName || newName === currentName) return;
    
    try {
        const { error } = await supabase
            .from(window.SUPABASE_CONFIG.recordsTable)
            .update({ name: newName })
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('重命名成功', 'success');
        await loadRecords();
    } catch (error) {
        console.error('重命名失败:', error);
        showToast('重命名失败', 'error');
    }
}

// Delete record
async function deleteRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    try {
        // Get record information
        const { data: record, error: fetchError } = await supabase
            .from(window.SUPABASE_CONFIG.recordsTable)
            .select('path')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;
        
        // Delete storage file
        const { error: storageError } = await supabase.storage
            .from(window.SUPABASE_CONFIG.storageBucket)
            .remove([record.path]);
        
        if (storageError) throw storageError;
        
        // Delete database record
        const { error: dbError } = await supabase
            .from(window.SUPABASE_CONFIG.recordsTable)
            .delete()
            .eq('id', id);
        
        if (dbError) throw dbError;
        
        showToast('删除成功', 'success');
        await loadRecords();
    } catch (error) {
        console.error('删除失败:', error);
        showToast('删除失败', 'error');
    }
}

// Ensure DOM elements are loaded
document.addEventListener('DOMContentLoaded', function() {
  setStatus('Page loaded, waiting for media files...');

  // 初始化获取videoGrid元素
  videoGrid = document.getElementById('videoGrid');
  
  // 检查是否找到videoGrid元素，如果没有，尝试使用备用ID
  if (!videoGrid) {
    console.warn('未找到ID为videoGrid的元素，尝试使用video-grid获取');
    videoGrid = document.querySelector('.video-grid');
    
    if (!videoGrid) {
      console.error('无法找到视频网格元素，应用可能无法正常工作');
      // 为了防止程序崩溃，创建一个新的videoGrid元素
      videoGrid = document.createElement('div');
      videoGrid.id = 'videoGrid';
      videoGrid.className = 'video-grid';
      document.body.appendChild(videoGrid);
      console.log('已创建新的视频网格元素作为备用');
    } else {
      console.log('找到视频网格元素:', videoGrid);
    }
  }

  // 确保我们有所有必需的元素
  if (!dropZone) {
    console.error('Drop zone element not found');
    return;
  }

  // 添加截图所有视频的按钮
  const screenshotAllButton = document.createElement('button');
  screenshotAllButton.id = 'screenshotAllButton';
  screenshotAllButton.className = 'screenshot-button';
  screenshotAllButton.textContent = SCREENSHOT_ALL_BUTTON_TEXT;
  screenshotAllButton.addEventListener('click', captureAllVideos);
  
  // 将按钮放在下载按钮旁边
  if (downloadAllButton) {
    downloadAllButton.parentNode.insertBefore(screenshotAllButton, downloadAllButton.nextSibling);
  } else {
    // 如果找不到下载按钮，添加到header
    const header = document.querySelector('.header');
    if (header) {
      header.appendChild(screenshotAllButton);
    }
  }

  // 设置拖放事件
  initDragAndDrop();
});

// Initialize drag and drop functionality
function initDragAndDrop() {
  // Add events to the drop zone
  dropZone.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setStatus('File being dragged in...');
    this.classList.add('dragover');
  }, false);

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.add('dragover');
  }, false);

  dropZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('dragover');
  }, false);

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('dragover');
    setStatus('Processing dropped files...');
    
    handleDrop(e);
  }, false);

  // Add events to the entire document body to enable drag and drop anywhere
  document.body.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setStatus('File being dragged in...');
    dropZone.classList.add('dragover');
  }, false);

  document.body.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  }, false);

  document.body.addEventListener('dragleave', function(e) {
    // Only remove highlight if leaving the entire document
    if(!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
      dropZone.classList.remove('dragover');
    }
    e.preventDefault();
    e.stopPropagation();
  }, false);

  document.body.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    setStatus('Processing dropped files...');
    
    handleDrop(e);
  }, false);

  // Add click to trigger file selection
  dropZone.addEventListener('click', function(e) {
    // If click is not on the button but on the drop zone, trigger folder select
    if (e.target !== folderSelectButton && !e.target.closest('#folderSelect')) {
      handleFolderSelect();
    }
  });

  setStatus('Drag and drop initialized');
}

// Handle folder select button click
folderSelectButton.addEventListener('click', handleFolderSelect, false);

function handleFolderSelect() {
  // Create a hidden file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.webkitdirectory = true; // Allow folder selection
  fileInput.directory = true; // Firefox support
  fileInput.multiple = true;
  
  setStatus('Opening folder selection dialog...');
  
  // Listen for file selection event
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    setStatus(`Detected ${files.length} files, filtering media files...`);
    
    // 为每个文件创建相对路径
    files.forEach(file => {
      // webkitRelativePath 格式为 "folder/subfolder/file.ext"
      if (file.webkitRelativePath) {
        file.fullPath = '/' + file.webkitRelativePath;
      }
    });
    
    // 构建目录树结构
    buildFolderTreeFromFiles(files);
    
    // Filter media files
    const mediaFiles = files.filter(file => {
      return SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
             SUPPORTED_TYPES.image.some(type => file.type === type);
    });
    
    // Calculate how many more media files we can add
    const currentMediaCount = videoGrid.children.length;
    const remainingSlots = MAX_VIDEOS - currentMediaCount;
    
    if (remainingSlots <= 0) {
      setStatus('Maximum file limit reached', true);
      showToast('Maximum file limit reached', 'error');
      return;
    }
    
    // Limit to remaining slots
    const filesToProcess = mediaFiles.slice(0, remainingSlots);
    
    // If no media files found
    if (filesToProcess.length === 0) {
      setStatus('No videos or images found in the selected folder', true);
      showToast('No videos or images found in the selected folder', 'error');
      return;
    }
    
    setStatus(`Processing ${filesToProcess.length} media files...`);
    
    // Process each media file
    filesToProcess.forEach(file => {
      if (SUPPORTED_TYPES.video.some(type => file.type.startsWith(type))) {
        createVideoElement(file);
      } else if (SUPPORTED_TYPES.image.some(type => file.type === type)) {
        createImageElement(file);
      }
    });
    
    setStatus(`Successfully added ${filesToProcess.length} media files`);
    // Show toast notification without alert dialog
    showToast(`Successfully added ${filesToProcess.length} media files`, 'success');
  });
  
  // Trigger file selection dialog
  fileInput.click();
}

function updateVideoCount() {
  // 统计所有媒体容器的数量
  let count = 0;
  
  // 获取所有的视频容器，包括在文件格子内的
  const allContainers = document.querySelectorAll('.video-container');
  count = allContainers.length;
  
  // 更新计数显示
  currentCount.textContent = count;
}

// Handle drop with better error handling
function handleDrop(e) {
  setStatus('Processing dropped files...');
  try {
    const dt = e.dataTransfer;
    
    // Check if we have items API support (Chrome, Safari)
    if (dt.items && dt.items.length > 0) {
      setStatus(`Detected ${dt.items.length} items, processing...`);
      
      // Create array to hold all detected items
      let hasFolder = false;
      
      // Check if any of the dragged items are folders
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : 
                        (item.getAsEntry ? item.getAsEntry() : null);
          
          if (entry && entry.isDirectory) {
            hasFolder = true;
            break;
          }
        }
      }
      
      // Process items as directories if any folders detected
      if (hasFolder) {
        setStatus('Folders detected, processing contents...');
        processDroppedItems(dt.items);
        return;
      }
      
      // If only files, process them directly
      const files = Array.from(dt.items)
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter(file => file !== null);
      
      if (files.length > 0) {
        processVideoFiles(files);
        return;
      }
    }
    
    // Fallback to files API if items API didn't work or no files found
    if (dt.files && dt.files.length > 0) {
      setStatus(`Detected ${dt.files.length} files, processing...`);
      processVideoFiles(Array.from(dt.files));
      return;
    }
    
    // No files or folders detected
    setStatus('No files or folders detected', true);
    showToast('No files or folders detected', 'error');
  } catch (error) {
    console.error('Error processing drop:', error);
    setStatus('Drop processing failed, try using the "Select Folder" button', true);
    showToast('Drop processing failed, try using the "Select Folder" button', 'error');
  }
}

// Process dropped items containing files and folders
function processDroppedItems(items) {
  // Convert items to an array
  const itemsArray = Array.from(items);
  const entries = [];
  
  // Get the file system entries for all items
  for (let i = 0; i < itemsArray.length; i++) {
    if (itemsArray[i].kind === 'file') {
      const entry = itemsArray[i].webkitGetAsEntry ? itemsArray[i].webkitGetAsEntry() :
                   (itemsArray[i].getAsEntry ? itemsArray[i].getAsEntry() : null);
      
      if (entry) {
        entries.push(entry);
      }
    }
  }
  
  // Process all entries (files and folders)
  if (entries.length > 0) {
    // 使用新的处理方法，构建文件树结构
    buildFileTreeAndTraverse(entries);
  } else {
    setStatus('No valid entries found', true);
    showToast('No valid entries found', 'error');
  }
}

// 构建文件树并处理文件
function buildFileTreeAndTraverse(entries) {
  // 重置文件树结构
  fileTreeStructure = {
    name: 'root',
    type: 'directory',
    children: [],
    expanded: true, // 根节点保持展开
    path: ''
  };
  
  // 跟踪处理中的目录和文件
  let pendingDirectories = 0;
  let processedEntries = 0;
  const allFiles = [];
  
  // 处理单个文件或目录
  function processEntry(entry, parentNode) {
    if (entry.isFile) {
      // 处理文件
      entry.file(file => {
        // 将完整路径添加到文件中
        file.fullPath = entry.fullPath || ('/' + file.name);
        
        // 为文件创建树节点
        const fileNode = {
          name: file.name,
          type: 'file',
          isMedia: SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
                   SUPPORTED_TYPES.image.some(type => file.type === type),
          fileObj: file,
          path: file.fullPath
        };
        
        // 添加到父节点
        parentNode.children.push(fileNode);
        
        // 如果是媒体文件，添加到处理列表
        if (fileNode.isMedia) {
          allFiles.push(file);
        }
        
        processedEntries++;
        checkCompletion();
      }, error => {
        console.error('Error getting file:', error);
        processedEntries++;
        checkCompletion();
      });
    } else if (entry.isDirectory) {
      pendingDirectories++;
      
      // 为目录创建树节点
      const dirNode = {
        name: entry.name,
        type: 'directory',
        children: [],
        expanded: false, // 默认收起
        path: entry.fullPath || ('/' + entry.name)
      };
      
      // 添加到父节点
      parentNode.children.push(dirNode);
      
      // 获取目录读取器
      const reader = entry.createReader();
      readDirectory(reader, dirNode);
    }
  }
  
  // 读取目录内容
  function readDirectory(reader, dirNode) {
    reader.readEntries(entries => {
      if (entries.length > 0) {
        // 处理每个条目
        entries.forEach(entry => processEntry(entry, dirNode));
        
        // 继续读取（目录可能返回部分结果）
        readDirectory(reader, dirNode);
      } else {
        // 该目录中没有更多条目
        pendingDirectories--;
        checkCompletion();
      }
    }, error => {
      console.error('Error reading directory:', error);
      pendingDirectories--;
      checkCompletion();
    });
  }
  
  // 检查所有处理是否完成
  function checkCompletion() {
    if (pendingDirectories === 0 && entries.length === processedEntries) {
      // 所有目录和文件都已处理完毕
      setStatus(`处理 ${allFiles.length} 个媒体文件...`);
      
      // 排序每个文件夹中的子项目（按名称A-Z排序）
      sortFileTree(fileTreeStructure);
      
      // 渲染文件树结构
      renderFileTree(fileTreeStructure);
      
      // 处理所有收集到的媒体文件（已按名称排序）
      processVideoFiles(allFiles.sort((a, b) => a.name.localeCompare(b.name)));
    }
  }
  
  // 开始处理所有条目
  entries.forEach(entry => processEntry(entry, fileTreeStructure));
}

// 渲染文件树到页面
function renderFileTree(rootNode) {
  // 创建文件树容器（如果不存在）
  let treeContainer = document.getElementById('fileTreeContainer');
  if (!treeContainer) {
    treeContainer = document.createElement('div');
    treeContainer.id = 'fileTreeContainer';
    treeContainer.className = 'file-tree-container';
    
    // 添加树视图标题
    const treeTitle = document.createElement('h2');
    treeTitle.textContent = '文件目录结构';
    treeContainer.appendChild(treeTitle);
    
    // 将树容器添加到页面
    document.querySelector('.drop-zone').after(treeContainer);
  } else {
    // 清空现有树
    treeContainer.innerHTML = '';
    const treeTitle = document.createElement('h2');
    treeTitle.textContent = '文件目录结构';
    treeContainer.appendChild(treeTitle);
  }
  
  // 创建并添加树结构
  const treeRoot = document.createElement('div');
  treeRoot.className = 'file-tree';
  treeContainer.appendChild(treeRoot);
  
  // 递归构建树
  function buildTreeUI(node, parentElement) {
    if (node.type === 'directory') {
      // 创建目录节点
      const folderItem = document.createElement('div');
      folderItem.className = 'tree-item folder';
      // 只有当节点设置为展开时才添加expanded类
      if (node.expanded) {
        folderItem.classList.add('expanded');
      }
      
      // 创建目录标题
      const folderTitle = document.createElement('div');
      folderTitle.className = 'folder-title';
      
      // 创建展开/折叠图标
      const expandIcon = document.createElement('span');
      expandIcon.className = 'expand-icon';
      expandIcon.textContent = node.expanded ? '▼' : '►';
      
      // 创建目录图标和名称
      const folderIcon = document.createElement('span');
      folderIcon.className = 'folder-icon';
      folderIcon.textContent = '📁';
      
      const folderName = document.createElement('span');
      folderName.className = 'folder-name';
      folderName.textContent = node.name;
      
      // 为文件夹添加颜色标识
      if (node.path && node.path !== '') {
        const folderLevel = calculateFolderLevel(node.path);
        folderName.setAttribute('data-folder-level', folderLevel.toString());
        folderName.style.padding = '1px 6px';
        folderName.style.borderRadius = '3px';
        folderName.style.marginLeft = '4px';
        
        // 根据计算的级别设置背景色和文字颜色
        if (document.body.classList.contains('dark-mode')) {
          // 暗黑模式颜色
          const bgColors = ['#483041', '#372f48', '#2f4837', '#483730', '#303748', '#483037', '#374830', '#304148', '#413048', '#484130'];
          const textColors = ['#e0b5d6', '#c4b5e0', '#b5e0c4', '#e0c4b5', '#b5c4e0', '#e0b5c4', '#c4e0b5', '#b5d6e0', '#d6b5e0', '#e0d6b5'];
          folderName.style.backgroundColor = bgColors[folderLevel];
          folderName.style.color = textColors[folderLevel];
        } else {
          // 浅色模式颜色
          const bgColors = ['#f5e2f0', '#e9e2f5', '#e2f5e9', '#f5e9e2', '#e2e9f5', '#f5e2e9', '#e9f5e2', '#e2f0f5', '#f0e2f5', '#f5f0e2'];
          const textColors = ['#703b61', '#4a3b70', '#3b704a', '#704a3b', '#3b4a70', '#703b4a', '#4a703b', '#3b6170', '#613b70', '#706b3b'];
          folderName.style.backgroundColor = bgColors[folderLevel];
          folderName.style.color = textColors[folderLevel];
        }
      }
      
      // 添加"仅看此文件夹"按钮
      const filterButton = document.createElement('button');
      filterButton.className = 'filter-folder-button';
      filterButton.textContent = '仅看此文件夹';
      filterButton.title = '仅显示此文件夹下的媒体文件';
      
      // 添加点击事件，过滤显示此文件夹的内容
      filterButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 阻止事件冒泡，避免触发折叠/展开
        console.log('点击了"仅看此文件夹"按钮，路径:', node.path);
        // 确保node.path存在且非空
        if (node.path) {
          try {
            filterVideosByFolder(node.path);
          } catch (error) {
            console.error('过滤文件夹时发生错误:', error);
            showToast('过滤文件夹时出错: ' + error.message, 'error');
          }
        } else {
          console.warn('文件夹路径为空，无法过滤');
          showToast('无法过滤: 文件夹路径为空', 'warning');
        }
      });
      
      // 组装目录标题
      folderTitle.appendChild(expandIcon);
      folderTitle.appendChild(folderIcon);
      folderTitle.appendChild(folderName);
      folderTitle.appendChild(filterButton);
      folderItem.appendChild(folderTitle);
      
      // 创建子项容器
      const folderContents = document.createElement('div');
      folderContents.className = 'folder-contents';
      folderItem.appendChild(folderContents);
      
      // 添加点击事件以展开/折叠
      folderTitle.addEventListener('click', () => {
        node.expanded = !node.expanded;
        folderItem.classList.toggle('expanded');
        expandIcon.textContent = node.expanded ? '▼' : '►';
      });
      
      // 添加到父元素
      parentElement.appendChild(folderItem);
      
      // 递归处理子项
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => buildTreeUI(child, folderContents));
      }
    } else if (node.type === 'file' && node.isMedia) {
      // 创建文件节点（仅显示媒体文件）
      const fileItem = document.createElement('div');
      fileItem.className = 'tree-item file';
      
      // 创建文件图标和名称
      const fileIcon = document.createElement('span');
      fileIcon.className = 'file-icon';
      if (node.fileObj.type.startsWith('video/')) {
        fileIcon.textContent = '🎬';
      } else {
        fileIcon.textContent = '🖼️';
      }
      
      const fileName = document.createElement('span');
      fileName.className = 'file-name';
      fileName.textContent = node.name;
      
      // 组装文件项
      fileItem.appendChild(fileIcon);
      fileItem.appendChild(fileName);
      
      // 添加点击事件，跳转到相应的视频
      fileItem.addEventListener('click', () => {
        scrollToMediaFile(node.path);
      });
      
      // 添加到父元素
      parentElement.appendChild(fileItem);
    }
  }
  
  // 对根目录的每个子项构建UI（跳过根目录自身）
  rootNode.children.forEach(child => buildTreeUI(child, treeRoot));
}

// 滚动到指定路径的媒体文件
function scrollToMediaFile(path) {
  if (!path) return;
  
  // 查找具有匹配路径的视频容器
  const allContainers = Array.from(document.querySelectorAll('.video-container'));
  const targetContainer = allContainers.find(container => container.dataset.path === path);
  
  if (targetContainer) {
    // 找到对应的行容器，确保它在视图中
    const parentRow = targetContainer.closest('.folder-row');
    if (parentRow) {
      parentRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // 然后滚动到目标容器
    setTimeout(() => {
    targetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 添加高亮效果
    targetContainer.classList.add('highlight');
    setTimeout(() => {
      targetContainer.classList.remove('highlight');
    }, 2000);
    }, 300);
  }
}

// Process video files
function processVideoFiles(files) {
  // 清空现有的视频网格
  videoGrid.innerHTML = '';
  
  // Filter video and image files
  const mediaFiles = files.filter(file => {
    return SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
           SUPPORTED_TYPES.image.some(type => file.type === type);
  });
  
  // Calculate how many more media files we can add
  const remainingSlots = MAX_VIDEOS;
  
  if (remainingSlots <= 0) {
    showToast('Maximum file limit reached', 'error');
    return;
  }
  
  // Limit to remaining slots
  const filesToProcess = mediaFiles.slice(0, remainingSlots);
  
  if (filesToProcess.length > 0) {
    // 创建基本容器
    const filesGrid = document.createElement('div');
    filesGrid.className = 'files-grid';
    filesGrid.style.display = 'grid';
    filesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
    filesGrid.style.gap = '16px';
    filesGrid.style.width = '100%';
    
    // 按名称排序文件
    filesToProcess.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
      if (SUPPORTED_TYPES.video.some(type => file.type.startsWith(type))) {
        createVideoElement(file, filesGrid);
      } else if (SUPPORTED_TYPES.image.some(type => file.type === type)) {
        createImageElement(file, filesGrid);
      }
    });
    
    // 添加到视频网格
    videoGrid.appendChild(filesGrid);
    videoGrid.style.display = 'block';
    
    // 显示成功消息
    if (filesToProcess.length > 1) {
      showToast(`Successfully added ${filesToProcess.length} media files`, 'success');
    } else if (filesToProcess.length === 1) {
      showToast(`Added file: ${filesToProcess[0].name}`, 'success');
    }
  } else if (files.length > 0) {
    // Message if files but no supported media
    showToast('No videos or images found', 'error');
  }
  
  // 更新视频计数和下载按钮状态
  updateVideoCount();
  updateDownloadButtonState();
}

function createVideoElement(file, parentContainer) {
  // 使用传入的父容器或默认的videoGrid
  const container = parentContainer || videoGrid;
  
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  
  // 添加文件路径数据属性（如果有）
  if (file.fullPath) {
    videoContainer.dataset.path = file.fullPath;
  }
  
  // Add mouse enter/leave events for audio control
  videoContainer.addEventListener('mouseenter', () => {
    video.muted = false;
  });
  
  videoContainer.addEventListener('mouseleave', () => {
    video.muted = true;
  });
  
  const videoWrapper = document.createElement('div');
  videoWrapper.className = 'video-wrapper';
  
  const video = document.createElement('video');
  video.src = URL.createObjectURL(file);
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.controls = true;
  
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-video';
  removeButton.innerHTML = '✕';
  removeButton.addEventListener('click', () => {
    videoContainer.remove();
    URL.revokeObjectURL(video.src); // Clean up the object URL
    updateVideoCount();
    updateDownloadButtonState();
  });
  
  // 添加截图按钮
  const screenshotButton = document.createElement('button');
  screenshotButton.className = 'screenshot-video-button';
  screenshotButton.innerHTML = '📸';
  screenshotButton.title = '截图';
  screenshotButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    try {
      // 高亮容器
      videoContainer.classList.add('capturing');
      
      // 获取文件名
      const filename = file.name.replace(/\.[^/.]+$/, '') + '_screenshot_' + Date.now() + '.jpg';
      
      // 截图
      await captureVideo(video, filename);
      
      // 显示成功消息
      showToast('截图已保存', 'success');
    } catch (err) {
      console.error('截图失败:', err);
      showToast('截图失败: ' + err.message, 'error');
    } finally {
      // 移除高亮
      videoContainer.classList.remove('capturing');
    }
  });
  
  const videoInfo = document.createElement('div');
  videoInfo.className = 'video-info';
  
  // 添加层级路径标识，显示在文件名之前
  if (file.fullPath) {
    const folderPath = getFolderPath(file.fullPath);
    if (folderPath && folderPath !== '/') {
      // 创建视频所在目录层级标签
      const pathTag = document.createElement('div');
      pathTag.className = 'path-tag';
      
      // 简化路径显示，将根目录和多层路径处理成更友好的格式
      const displayPath = formatDisplayPath(folderPath);
      
      // 添加文件夹级别属性以应用颜色
      const folderLevel = calculateFolderLevel(folderPath);
      pathTag.setAttribute('data-folder-level', folderLevel.toString());
      
      pathTag.textContent = displayPath;
      videoInfo.appendChild(pathTag);
    }
  }
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  videoWrapper.appendChild(video);
  videoContainer.appendChild(removeButton);
  videoContainer.appendChild(screenshotButton); // 添加截图按钮
  videoContainer.appendChild(videoWrapper);
  videoInfo.appendChild(filename);
  
  // 添加完整路径显示在文件名下方
  if (file.fullPath) {
    const pathElement = document.createElement('div');
    pathElement.className = 'video-path';
    // 显示完整的父目录路径，不包括文件名
    const pathParts = file.fullPath.split('/');
    pathParts.pop(); // 移除文件名
    const directoryPath = pathParts.join('/') || '/';
    pathElement.textContent = directoryPath;
    videoInfo.appendChild(pathElement);
  }
  
  videoContainer.appendChild(videoInfo);
  container.appendChild(videoContainer);
  
  // 更新视频计数，但不重复调用，让函数的调用者决定是否更新
  if (container === videoGrid) {
  updateVideoCount();
  updateDownloadButtonState();
  }
  
  // Clean up object URL when video is removed from DOM
  video.addEventListener('loadedmetadata', () => {
    // Adjust container height based on video ratio
    const videoRatio = video.videoWidth / video.videoHeight;
    if (videoRatio < 1) {
      // Vertical video
      video.style.height = 'auto';
      video.style.width = '100%';
    }
  });
  
  return videoContainer;
}

function createImageElement(file, parentContainer) {
  // 使用传入的父容器或默认的videoGrid
  const container = parentContainer || videoGrid;
  
  const imageContainer = document.createElement('div');
  imageContainer.className = 'video-container';
  
  // 添加文件路径数据属性（如果有）
  if (file.fullPath) {
    imageContainer.dataset.path = file.fullPath;
  }
  
  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'video-wrapper';
  
  const image = document.createElement('img');
  image.src = URL.createObjectURL(file);
  image.className = 'image-preview';
  
  const removeButton = document.createElement('button');
  removeButton.className = 'remove-video';
  removeButton.innerHTML = '✕';
  removeButton.addEventListener('click', () => {
    imageContainer.remove();
    URL.revokeObjectURL(image.src); // Clean up the object URL
    updateVideoCount();
    updateDownloadButtonState();
  });
  
  // 添加截图按钮
  const screenshotButton = document.createElement('button');
  screenshotButton.className = 'screenshot-video-button';
  screenshotButton.innerHTML = '📸';
  screenshotButton.title = '截图';
  screenshotButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    try {
      // 高亮容器
      imageContainer.classList.add('capturing');
      
      // 获取文件名
      const filename = file.name.replace(/\.[^/.]+$/, '') + '_screenshot_' + Date.now() + '.jpg';
      
      // 截图
      await captureImage(image, filename);
      
      // 显示成功消息
      showToast('截图已保存', 'success');
    } catch (err) {
      console.error('截图失败:', err);
      showToast('截图失败: ' + err.message, 'error');
    } finally {
      // 移除高亮
      imageContainer.classList.remove('capturing');
    }
  });
  
  const imageInfo = document.createElement('div');
  imageInfo.className = 'video-info';
  
  // 添加层级路径标识，显示在文件名之前
  if (file.fullPath) {
    const folderPath = getFolderPath(file.fullPath);
    if (folderPath && folderPath !== '/') {
      // 创建图片所在目录层级标签
      const pathTag = document.createElement('div');
      pathTag.className = 'path-tag';
      
      // 简化路径显示，将根目录和多层路径处理成更友好的格式
      const displayPath = formatDisplayPath(folderPath);
      
      // 添加文件夹级别属性以应用颜色
      const folderLevel = calculateFolderLevel(folderPath);
      pathTag.setAttribute('data-folder-level', folderLevel.toString());
      
      pathTag.textContent = displayPath;
      imageInfo.appendChild(pathTag);
    }
  }
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  imageWrapper.appendChild(image);
  imageContainer.appendChild(removeButton);
  imageContainer.appendChild(screenshotButton); // 添加截图按钮
  imageContainer.appendChild(imageWrapper);
  imageInfo.appendChild(filename);
  
  // 添加路径显示
  if (file.fullPath) {
    const pathElement = document.createElement('div');
    pathElement.className = 'video-path';
    // 显示完整的父目录路径，不包括文件名
    const pathParts = file.fullPath.split('/');
    pathParts.pop(); // 移除文件名
    const directoryPath = pathParts.join('/') || '/';
    pathElement.textContent = directoryPath;
    imageInfo.appendChild(pathElement);
  }
  
  imageContainer.appendChild(imageInfo);
  container.appendChild(imageContainer);
  
  // 更新视频计数，但不重复调用，让函数的调用者决定是否更新
  if (container === videoGrid) {
  updateVideoCount();
  updateDownloadButtonState();
  }
  
  return imageContainer;
}

// Initialize video count
updateVideoCount();
downloadAllButton.addEventListener('click', handleDownloadAll);
updateDownloadButtonState();

function updateDownloadButtonState() {
  // 检查是否有任何媒体文件
  const hasVideos = document.querySelectorAll('.video-container').length > 0;
  downloadAllButton.disabled = !hasVideos;
}

function handleDownloadAll() {
  // 获取所有视频容器
  const allContainers = Array.from(document.querySelectorAll('.video-container'));
  
  // 处理每个容器以触发下载
  allContainers.forEach((container, index) => {
    const video = container.querySelector('video');
    const img = container.querySelector('img');
    const filename = container.querySelector('.video-filename').textContent;
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = video ? video.src : img.src;
    a.download = filename; // Use original filename
    
    // Trigger download with a small delay between each file
    setTimeout(() => {
      a.click();
    }, index * 500); // 500ms delay between each download
  });
}

// 从选择的文件构建目录树
function buildFolderTreeFromFiles(files) {
  // 创建根节点
  fileTreeStructure = {
    name: 'root',
    type: 'directory',
    children: [],
    expanded: true, // 根节点保持展开
    path: ''
  };
  
  // 处理每个文件
  files.forEach(file => {
    if (!file.webkitRelativePath) return;
    
    // 分割路径
    const pathParts = file.webkitRelativePath.split('/');
    let currentNode = fileTreeStructure;
    
    // 遍历路径的每一部分（除了最后一个，它是文件名）
    for (let i = 0; i < pathParts.length - 1; i++) {
      const partName = pathParts[i];
      
      // 查找现有的目录节点
      let found = false;
      for (let j = 0; j < currentNode.children.length; j++) {
        if (currentNode.children[j].type === 'directory' && currentNode.children[j].name === partName) {
          currentNode = currentNode.children[j];
          found = true;
          break;
        }
      }
      
      // 如果目录不存在，创建它
      if (!found) {
        // 构建到此级别的路径
        let path = '/';
        for (let k = 0; k <= i; k++) {
          path += pathParts[k] + (k < i ? '/' : '');
        }
        
        const newDir = {
          name: partName,
          type: 'directory',
          children: [],
          expanded: false, // 默认收起
          path: path
        };
        currentNode.children.push(newDir);
        currentNode = newDir;
      }
    }
    
    // 添加文件节点
    const isMedia = SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
                    SUPPORTED_TYPES.image.some(type => file.type === type);
    
    if (isMedia) {
      const fileNode = {
        name: pathParts[pathParts.length - 1],
        type: 'file',
        isMedia: true,
        fileObj: file,
        path: '/' + file.webkitRelativePath
      };
      currentNode.children.push(fileNode);
    }
  });
  
  // 渲染树结构
  renderFileTree(fileTreeStructure);
}

// 获取文件的目录路径
function getFolderPath(fullPath) {
  if (!fullPath) return '';
  const pathParts = fullPath.split('/');
  pathParts.pop(); // 移除文件名
  return pathParts.join('/') || '/';
}

// 格式化路径显示
function formatDisplayPath(path) {
  if (!path || path === '/') return '';
  
  // 移除开头的斜杠
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const parts = cleanPath.split('/');
  
  // 只显示最后一级文件夹名称
  if (parts.length >= 1) {
    const lastDir = parts[parts.length - 1];
    return `📁 ${lastDir}`;
  }
  
  // 如果没有文件夹层级，返回空字符串
  return '';
}

// 计算文件夹级别以应用不同颜色
function calculateFolderLevel(path) {
  if (!path || path === '/') return 0;
  
  // 处理路径中的哈希值
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const parts = cleanPath.split('/');
    
  // 使用路径的哈希值计算0-9之间的数字，确保同一路径始终得到相同的颜色
  let hash = 0;
  for (let i = 0; i < cleanPath.length; i++) {
    hash = ((hash << 5) - hash) + cleanPath.charCodeAt(i);
    hash |= 0; // 转换为32位整数
  }
  
  // 取绝对值并对10取模，得到0-9之间的数字
  return Math.abs(hash % 10);
}

// 获取文件的直接父目录路径（最子目录）
function getParentDirectory(fullPath) {
  if (!fullPath || fullPath === '/') return '/';
  
  // 分割路径
  const parts = fullPath.split('/');
  // 移除文件名
  parts.pop();
  
  // 如果路径为空或者只有根，返回根路径
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return '/';
  }
  
  // 返回完整父目录路径
  return parts.join('/');
}

// 按文件夹过滤视频
function filterVideosByFolder(folderPath) {
  console.log('正在过滤文件夹:', folderPath);
  
  // 不使用局部变量，使用全局videoGrid变量
  if (!videoGrid) {
    console.error('视频网格元素未找到');
    showToast('无法找到视频网格元素', 'error');
    return;
  }
  
  // 切换过滤状态
  if (currentFilterPath === folderPath) {
    // 如果点击同一个文件夹，则取消过滤
    resetFilter();
    return;
  }
  
  // 更新当前过滤路径
  currentFilterPath = folderPath;
  
  // 仅在第一次过滤时保存原始布局
  if (!window.originalVideoLayout) {
    window.originalVideoLayout = videoGrid.cloneNode(true);
    console.log('已保存原始视频布局');
  }
  
  // 创建过滤信息显示
  const filterInfo = document.createElement('div');
  filterInfo.className = 'filter-info';
  filterInfo.innerHTML = `
    <span class="filter-title">当前仅显示：</span>
    <span class="filter-path">${folderPath}</span>
    <button class="reset-filter-button">显示全部</button>
  `;
  
  const resetButton = filterInfo.querySelector('.reset-filter-button');
  resetButton.addEventListener('click', resetFilter);
  
  // 先清除现有的过滤信息
  const existingFilterInfo = document.querySelector('.filter-info');
  if (existingFilterInfo) {
    existingFilterInfo.remove();
  }
  
  // 将过滤信息添加到视频网格前面
  videoGrid.parentNode.insertBefore(filterInfo, videoGrid);
  
  // 获取所有视频容器
  let allContainers = [];
  
  // 如果原始布局已保存，从原始布局中获取容器
  if (window.originalVideoLayout) {
    allContainers = Array.from(window.originalVideoLayout.querySelectorAll('.video-container, .image-container'));
    console.log(`从原始布局中找到 ${allContainers.length} 个媒体容器`);
    } else {
    // 否则从当前DOM中获取容器
    allContainers = Array.from(videoGrid.querySelectorAll('.video-container, .image-container'));
    console.log(`从当前DOM中找到 ${allContainers.length} 个媒体容器`);
  }
  
  // 过滤符合条件的容器
  const filteredContainers = allContainers.filter(container => {
    const path = container.dataset.path || '';
    const match = path.startsWith(folderPath);
    if (match) {
      console.log(`匹配路径: ${path}`);
    }
    return match;
  });
  
  console.log(`过滤后符合条件的容器数量: ${filteredContainers.length}`);
  
  // 清空当前网格
  videoGrid.innerHTML = '';
  
  if (filteredContainers.length === 0) {
    // 显示无结果提示
    const noResults = document.createElement('div');
    noResults.className = 'no-filter-results';
    noResults.textContent = `在路径 "${folderPath}" 中未找到媒体文件`;
    videoGrid.appendChild(noResults);
    showToast(`在路径 "${folderPath}" 中未找到媒体文件`, 'info');
  } else {
    // 创建单一网格容器
    const filesGrid = document.createElement('div');
    filesGrid.className = 'files-grid';
    filesGrid.style.display = 'grid';
    filesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
    filesGrid.style.gap = '16px';
    filesGrid.style.width = '100%';
    
    // 对过滤后的容器按文件名排序
    filteredContainers.sort((a, b) => {
      const nameA = a.querySelector('.video-filename')?.textContent || '';
      const nameB = b.querySelector('.video-filename')?.textContent || '';
      return nameA.localeCompare(nameB);
    });
    
    // 为每个过滤后的容器添加事件监听器并添加到网格
    filteredContainers.forEach(container => {
      // 创建深拷贝以避免修改原始元素
      const clonedContainer = container.cloneNode(true);
      const newContainer = attachEventListenersToContainer(clonedContainer);
      filesGrid.appendChild(newContainer);
    });
    
    // 将网格添加到视频容器
    videoGrid.appendChild(filesGrid);
    
    // 确保视频网格样式正确
    videoGrid.style.display = 'block';
    
    showToast(`已过滤: 显示 ${filteredContainers.length} 个媒体文件`, 'success');
  }
  
  // 在处理后更新一次视频计数
  updateVideoCount();
  updateDownloadButtonState();
}

// 重置过滤器，显示所有视频
function resetFilter() {
  console.log('正在重置过滤器...');
  
  if (!window.originalVideoLayout) {
    console.warn('没有保存的原始布局，无法重置');
    return;
  }
  
  // 移除过滤信息
  const filterInfo = document.querySelector('.filter-info');
  if (filterInfo) {
    filterInfo.remove();
  }
  
  // 使用全局videoGrid变量
  if (!videoGrid) {
    console.error('视频网格元素未找到');
    return;
  }
  
  console.log('正在恢复原始视频布局...');
  
  // 清空当前网格
  videoGrid.innerHTML = '';
  
  // 创建单一网格容器
  const filesGrid = document.createElement('div');
  filesGrid.className = 'files-grid';
  filesGrid.style.display = 'grid';
  filesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
  filesGrid.style.gap = '16px';
  filesGrid.style.width = '100%';
  
  // 获取原始布局中的所有容器
  const originalContainers = Array.from(window.originalVideoLayout.querySelectorAll('.video-container, .image-container'));
  console.log(`从原始布局中检索到 ${originalContainers.length} 个容器`);
  
  // 对容器按文件名排序
  originalContainers.sort((a, b) => {
    const nameA = a.querySelector('.video-filename')?.textContent || '';
    const nameB = b.querySelector('.video-filename')?.textContent || '';
    return nameA.localeCompare(nameB);
  });
  
  // 为每个容器添加事件监听器并添加到格子网格
  originalContainers.forEach(container => {
    const clonedContainer = container.cloneNode(true);
    const newContainer = attachEventListenersToContainer(clonedContainer);
    filesGrid.appendChild(newContainer);
  });
  
  // 将格子网格添加到视频网格
  videoGrid.appendChild(filesGrid);
  
  // 确保视频网格样式正确
  videoGrid.style.display = 'block';
  
  // 重置过滤状态
  currentFilterPath = null;
  
  // 更新视频计数和下载按钮状态
  updateVideoCount();
  updateDownloadButtonState();
  
  showToast('已显示全部媒体文件', 'success');
  console.log('过滤器已重置');
}

// 将事件监听器添加到克隆的容器
function attachEventListenersToContainer(container) {
  // 添加视频音频事件
  const video = container.querySelector('video');
  if (video) {
    container.addEventListener('mouseenter', () => {
      video.muted = false;
    });
    
    container.addEventListener('mouseleave', () => {
      video.muted = true;
    });
    
    // 确保视频大小正确
    video.addEventListener('loadedmetadata', () => {
      // Adjust container height based on video ratio
      const videoRatio = video.videoWidth / video.videoHeight;
      if (videoRatio < 1) {
        // Vertical video
        video.style.height = 'auto';
        video.style.width = '100%';
      }
    });
  }
  
  // 添加删除按钮事件
  const removeButton = container.querySelector('.remove-video');
  if (removeButton) {
    removeButton.addEventListener('click', () => {
      container.remove();
      if (video) {
        URL.revokeObjectURL(video.src);
      } else {
        const img = container.querySelector('img');
        if (img) {
          URL.revokeObjectURL(img.src);
        }
      }
      updateVideoCount();
      updateDownloadButtonState();
    });
  }
  
  // 添加截图按钮事件
  const screenshotButton = container.querySelector('.screenshot-video-button');
  if (screenshotButton) {
    screenshotButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      try {
        // 高亮容器
        container.classList.add('capturing');
        
        // 获取文件名
        const filenameElement = container.querySelector('.video-filename');
        const filename = (filenameElement ? filenameElement.textContent : 'screenshot') + '_' + Date.now() + '.jpg';
        
        // 截图
        if (video) {
          await captureVideo(video, filename);
        } else {
          const img = container.querySelector('img.image-preview');
          if (img) {
            await captureImage(img, filename);
          }
        }
        
        // 显示成功消息
        showToast('截图已保存', 'success');
      } catch (err) {
        console.error('截图失败:', err);
        showToast('截图失败: ' + err.message, 'error');
      } finally {
        // 移除高亮
        container.classList.remove('capturing');
      }
    });
  }
  
  return container;
}

// 递归排序文件树中的每个文件夹内容
function sortFileTree(node) {
  if (node.children && node.children.length > 0) {
    // 先递归排序所有子文件夹
    node.children.forEach(child => {
      if (child.type === 'directory') {
        sortFileTree(child);
      }
    });
    
    // 然后对当前节点的子项按名称排序
    // 目录排在前面，文件排在后面，各自内部按名称字母顺序排列
    node.children.sort((a, b) => {
      // 如果类型不同，目录排在文件前面
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      
      // 类型相同，按名称排序（不区分大小写）
      return a.name.localeCompare(b.name, undefined, {sensitivity: 'base'});
    });
  }
  
  return node;
}

// 截取单个视频的函数
function captureVideo(video, filename) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 设置合适的尺寸（如果视频太大）
      const maxDimension = 1920; // 最大宽度/高度限制
      if (canvas.width > maxDimension || canvas.height > maxDimension) {
        const ratio = Math.min(maxDimension / canvas.width, maxDimension / canvas.height);
        canvas.width = canvas.width * ratio;
        canvas.height = canvas.height * ratio;
      }
      
      // 绘制视频帧到canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 将canvas转换为Blob
      canvas.toBlob(blob => {
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || (SCREENSHOT_FILENAME_PREFIX + Date.now() + '.jpg');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(true);
        }, 100);
      }, 'image/jpeg', 0.9);
      
    } catch (e) {
      console.error('截图过程中出错:', e);
      reject(e);
    }
  });
}

// 截取图片元素的函数
function captureImage(imgElement, filename) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时canvas
      const canvas = document.createElement('canvas');
      
      // 设置合适的尺寸
      let width = imgElement.naturalWidth;
      let height = imgElement.naturalHeight;
      
      // 设置合适的尺寸（如果图片太大）
      const maxDimension = 1920; // 最大宽度/高度限制
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = width * ratio;
        height = height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 绘制图片到canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0, width, height);
      
      // 将canvas转换为Blob
      canvas.toBlob(blob => {
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || (SCREENSHOT_FILENAME_PREFIX + Date.now() + '.jpg');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(true);
        }, 100);
      }, 'image/jpeg', 0.9);
      
    } catch (e) {
      console.error('截图过程中出错:', e);
      reject(e);
    }
  });
}

// 截取所有视频并合并为一张图片
async function captureAllVideos() {
  const containers = document.querySelectorAll('.video-container');
  
  if (containers.length === 0) {
    showToast('没有可截图的媒体文件', 'info');
    return;
  }
  
  showToast(`开始截图 ${containers.length} 个媒体文件并合成...`, 'info');
  
  let capturedImages = [];
  let errorCount = 0;
  
  // 创建一个时间戳作为文件标记
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // 第一步：捕获所有图像到内存
  for (let i = 0; i < containers.length; i++) {
    const container = containers[i];
    try {
      // 高亮当前容器
      container.classList.add('capturing');
      
      // 检查是视频还是图片
      const video = container.querySelector('video');
      const img = container.querySelector('img.image-preview');
      const filename = container.querySelector('.video-filename')?.textContent || '';
      
      // 捕获视频/图像帧到canvas
      let imgData;
      
      if (video) {
        // 视频容器
        imgData = await captureVideoToCanvas(video);
      } else if (img) {
        // 图片容器 
        imgData = await captureImageToCanvas(img);
      } else {
        throw new Error("未找到可截图的元素");
      }
      
      if (imgData) {
        // 添加文件名作为标题
        imgData.title = filename;
        capturedImages.push(imgData);
      }
      
      // 移除高亮
      container.classList.remove('capturing');
      
      // 短暂延迟，避免浏览器过载
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (e) {
      console.error(`截图第 ${i+1} 个媒体文件时出错:`, e);
      container.classList.remove('capturing');
      errorCount++;
    }
  }
  
  // 第二步：计算组合图像的布局
  if (capturedImages.length === 0) {
    showToast('没有可用的媒体截图', 'error');
    return;
  }
  
  try {
    // 计算最佳网格布局
    const layout = calculateGridLayout(capturedImages);
    
    // 创建组合图像
    const combinedImage = await createCombinedImage(capturedImages, layout);
    
    // 下载组合图像
    const combinedFilename = `combined_screenshots_${timestamp}.jpg`;
    downloadCanvasAsJpeg(combinedImage, combinedFilename);
    
    // 显示成功消息
    showToast(`成功合成 ${capturedImages.length} 个媒体文件截图`, 'success');
  } catch (err) {
    console.error('创建组合图像失败:', err);
    showToast(`合成图像失败: ${err.message}`, 'error');
  }
}

// 将视频帧截取到canvas并返回图像数据
function captureVideoToCanvas(video) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // 设置合适的尺寸（如果视频太大）
      const maxDimension = 800; // 组合图像中每个截图的最大尺寸
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 绘制视频帧到canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);
      
      // 返回画布和尺寸信息
      resolve({
        canvas: canvas,
        width: width,
        height: height,
        aspectRatio: width / height
      });
    } catch (e) {
      console.error('截取视频帧到canvas时出错:', e);
      reject(e);
    }
  });
}

// 将图片截取到canvas并返回图像数据
function captureImageToCanvas(imgElement) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时canvas
      const canvas = document.createElement('canvas');
      
      // 设置合适的尺寸
      let width = imgElement.naturalWidth;
      let height = imgElement.naturalHeight;
      
      // 设置合适的尺寸（如果图片太大）
      const maxDimension = 800; // 组合图像中每个截图的最大尺寸
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 绘制图片到canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0, width, height);
      
      // 返回画布和尺寸信息
      resolve({
        canvas: canvas,
        width: width,
        height: height,
        aspectRatio: width / height
      });
    } catch (e) {
      console.error('截取图片到canvas时出错:', e);
      reject(e);
    }
  });
}

// 计算最佳网格布局
function calculateGridLayout(images) {
  const count = images.length;
  
  // 根据图片数量确定网格布局
  let cols, rows;
  
  if (count <= 1) {
    cols = 1;
    rows = 1;
  } else if (count <= 2) {
    cols = 2;
    rows = 1;
  } else if (count <= 4) {
    cols = 2;
    rows = 2;
  } else if (count <= 6) {
    cols = 3;
    rows = 2;
  } else if (count <= 9) {
    cols = 3;
    rows = 3;
  } else if (count <= 12) {
    cols = 4;
    rows = 3;
  } else if (count <= 16) {
    cols = 4;
    rows = 4;
  } else if (count <= 20) {
    cols = 5;
    rows = 4;
  } else {
    // 对于更多的图片，计算最接近平方根的行列数
    cols = Math.ceil(Math.sqrt(count));
    rows = Math.ceil(count / cols);
  }
  
  return { cols, rows };
}

// 创建合并的图像
function createCombinedImage(images, layout) {
  return new Promise((resolve, reject) => {
    try {
      const { cols, rows } = layout;
      
      // 计算每个单元格的尺寸和输出画布的尺寸
      const cellPadding = 10; // 单元格之间的间距
      const titleHeight = 30; // 标题的高度
      const cellWidth = 800; // 每个单元格的最大宽度
      const cellHeight = 600 + titleHeight; // 每个单元格的最大高度(包括标题)
      
      // 创建输出画布
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = cols * cellWidth + (cols + 1) * cellPadding;
      outputCanvas.height = rows * cellHeight + (rows + 1) * cellPadding;
      
      // 获取画布上下文
      const ctx = outputCanvas.getContext('2d');
      
      // 填充背景
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
      
      // 绘制每个图像
      for (let i = 0; i < images.length; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const img = images[i];
        
        // 计算单元格位置
        const cellX = col * cellWidth + (col + 1) * cellPadding;
        const cellY = row * cellHeight + (row + 1) * cellPadding;
        
        // 填充单元格背景
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
        
        // 绘制图像，保持宽高比并居中
        const imgWidth = img.width;
        const imgHeight = img.height;
        
        // 计算图像的缩放和位置，保持宽高比
        let drawWidth = imgWidth;
        let drawHeight = imgHeight;
        
        if (drawWidth > cellWidth - 20) {
          const ratio = (cellWidth - 20) / drawWidth;
          drawWidth = drawWidth * ratio;
          drawHeight = drawHeight * ratio;
        }
        
        if (drawHeight > cellHeight - titleHeight - 20) {
          const ratio = (cellHeight - titleHeight - 20) / drawHeight;
          drawWidth = drawWidth * ratio;
          drawHeight = drawHeight * ratio;
        }
        
        // 计算居中位置
        const imgX = cellX + (cellWidth - drawWidth) / 2;
        const imgY = cellY + titleHeight + (cellHeight - titleHeight - drawHeight) / 2;
        
        // 绘制图像
        ctx.drawImage(img.canvas, imgX, imgY, drawWidth, drawHeight);
        
        // 添加标题
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        const title = img.title || `图像 ${i+1}`;
        const maxTitleWidth = cellWidth - 20;
        const truncatedTitle = truncateText(ctx, title, maxTitleWidth);
        ctx.fillText(truncatedTitle, cellX + cellWidth / 2, cellY + 20);
      }
      
      resolve(outputCanvas);
    } catch (err) {
      console.error('创建合并图像时出错:', err);
      reject(err);
    }
  });
}

// 下载画布为JPEG
function downloadCanvasAsJpeg(canvas, filename) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, 'image/jpeg', 0.9);
}

// 截断文本以适应最大宽度
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.substring(0, truncated.length - 1);
  }
  
  return truncated + '...';
}

// 添加新的性能优化配置
const PERFORMANCE_CONFIG = {
  lazyLoadDistance: 300,      // 懒加载检测距离（像素）
  batchSize: 15,              // 每批处理的视频数量
  processingDelay: 50,        // 批处理间隔时间（毫秒）
  cleanupInterval: 30000,     // 自动清理不可见视频的间隔（毫秒）
  maxVisible: 50,             // 最大同时可见的视频数量
  virtualScrolling: true,     // 启用虚拟滚动
  usePlaceholders: true,      // 使用占位符
};

// 存储已加载的视频对象，便于后续清理
let videoRegistry = new Map();

// 页面可见性检测变量
let isPageVisible = true;

// 添加页面可见性监听
document.addEventListener('visibilitychange', function() {
  isPageVisible = document.visibilityState === 'visible';
  
  // 页面可见时重新加载可视区域的视频
  if (isPageVisible) {
    refreshVisibleVideos();
  } else {
    // 页面不可见时暂停所有视频播放
    pauseAllVideos();
  }
});

// 暂停所有视频播放
function pauseAllVideos() {
  document.querySelectorAll('video').forEach(video => {
    try {
      if (!video.paused) {
        video.pause();
      }
    } catch (e) {
      console.error('无法暂停视频:', e);
    }
  });
}

// 虚拟滚动管理器
class VirtualScrollManager {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({}, PERFORMANCE_CONFIG, options);
    this.items = [];
    this.visibleItems = new Set();
    this.lastScrollY = 0;
    this.ticking = false;
    this.initialized = false;
    
    // 绑定滚动监听
    this.scrollHandler = this.onScroll.bind(this);
    this.resizeHandler = this.onResize.bind(this);
    
    // 初始化容器样式
    if (this.container) {
      // 确保容器有相对或绝对定位，用于放置占位符
      const position = window.getComputedStyle(this.container).position;
      if (position !== 'relative' && position !== 'absolute') {
        this.container.style.position = 'relative';
      }
      
      // 添加事件监听
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
      window.addEventListener('resize', this.resizeHandler, { passive: true });
      this.initialized = true;
    }
  }
  
  // 销毁管理器，移除事件监听
  destroy() {
    if (this.initialized) {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.resizeHandler);
      this.initialized = false;
    }
  }
  
  // 添加元素到管理器
  addItem(element, data = {}) {
    if (!element) return;
    
    const item = {
      element: element,
      data: data,
      visible: false,
      rect: null,
      placeholder: null
    };
    
    this.items.push(item);
    this.updateItemMetrics(item);
    this.checkItemVisibility(item);
    
    return item;
  }
  
  // 移除元素
  removeItem(element) {
    const index = this.items.findIndex(item => item.element === element);
    if (index >= 0) {
      const item = this.items[index];
      if (item.visible) {
        this.visibleItems.delete(item);
      }
      if (item.placeholder) {
        item.placeholder.remove();
      }
      this.items.splice(index, 1);
    }
  }
  
  // 清空所有元素
  clearItems() {
    this.items.forEach(item => {
      if (item.placeholder) {
        item.placeholder.remove();
      }
    });
    this.items = [];
    this.visibleItems.clear();
  }
  
  // 滚动事件处理
  onScroll() {
    this.lastScrollY = window.scrollY;
    
    if (!this.ticking) {
      window.requestAnimationFrame(() => {
        this.updateVisibleItems();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }
  
  // 窗口大小变化事件处理
  onResize() {
    this.updateAllItemMetrics();
    this.updateVisibleItems();
  }
  
  // 更新所有元素的位置信息
  updateAllItemMetrics() {
    this.items.forEach(item => this.updateItemMetrics(item));
  }
  
  // 更新单个元素的位置信息
  updateItemMetrics(item) {
    if (!item.element) return;
    
    item.rect = item.element.getBoundingClientRect();
  }
  
  // 更新可见元素
  updateVisibleItems() {
    if (!isPageVisible || !this.initialized) return;
    
    // 获取可视区域范围
    const viewportTop = this.lastScrollY;
    const viewportBottom = viewportTop + window.innerHeight;
    const lazyDistance = this.options.lazyLoadDistance;
    
    // 扩展可视区域包括懒加载范围
    const extendedTop = viewportTop - lazyDistance;
    const extendedBottom = viewportBottom + lazyDistance;
    
    // 更新每个元素的可见性
    this.items.forEach(item => {
      if (!item.element) return;
      
      // 更新元素位置信息
      this.updateItemMetrics(item);
      
      // 检查是否在扩展可视区域内
      const wasVisible = item.visible;
      this.checkItemVisibility(item, extendedTop, extendedBottom);
      
      // 如果可见性发生变化
      if (wasVisible !== item.visible) {
        if (item.visible) {
          // 变为可见
          this.visibleItems.add(item);
          this.onItemVisible(item);
        } else {
          // 变为不可见
          this.visibleItems.delete(item);
          this.onItemHidden(item);
        }
      }
    });
    
    // 如果可见元素超过最大数量，隐藏最远的元素
    if (this.visibleItems.size > this.options.maxVisible) {
      this.limitVisibleItems();
    }
  }
  
  // 检查元素是否在可视区域内
  checkItemVisibility(item, extendedTop, extendedBottom) {
    if (!item.rect) return;
    
    const viewportTop = extendedTop || (this.lastScrollY - this.options.lazyLoadDistance);
    const viewportBottom = extendedBottom || (this.lastScrollY + window.innerHeight + this.options.lazyLoadDistance);
    
    const elementTop = this.lastScrollY + item.rect.top;
    const elementBottom = elementTop + item.rect.height;
    
    // 元素与可视区域有交叉
    item.visible = !(elementBottom < viewportTop || elementTop > viewportBottom);
  }
  
  // 限制可见元素数量
  limitVisibleItems() {
    if (this.visibleItems.size <= this.options.maxVisible) return;
    
    // 计算每个可见元素到视口中心的距离
    const viewportMiddle = this.lastScrollY + (window.innerHeight / 2);
    
    // 将可见元素转换为数组并按距离排序
    const sortedItems = Array.from(this.visibleItems).map(item => {
      const itemMiddle = this.lastScrollY + item.rect.top + (item.rect.height / 2);
      const distance = Math.abs(viewportMiddle - itemMiddle);
      return { item, distance };
    }).sort((a, b) => a.distance - b.distance);
    
    // 保留最靠近视口的元素
    const keepItems = sortedItems.slice(0, this.options.maxVisible);
    const removeItems = sortedItems.slice(this.options.maxVisible);
    
    // 隐藏多余的元素
    removeItems.forEach(({ item }) => {
      this.visibleItems.delete(item);
      this.onItemHidden(item);
    });
  }
  
  // 元素变为可见时的回调
  onItemVisible(item) {
    if (!item.element) return;
    
    // 对于视频元素，加载视频源并开始播放（如果自动播放）
    const video = item.element.querySelector('video');
    if (video) {
      if (video.dataset.src && !video.src) {
        video.src = video.dataset.src;
        video.load();
      }
    }
    
    // 移除占位符（如果有）
    if (item.placeholder && this.options.usePlaceholders) {
      item.placeholder.style.display = 'none';
    }
    
    // 显示实际元素
    item.element.style.display = '';
  }
  
  // 元素变为不可见时的回调
  onItemHidden(item) {
    if (!item.element) return;
    
    // 对于视频元素，可以选择暂停并清空源以节省资源
    const video = item.element.querySelector('video');
    if (video) {
      if (!video.paused) {
        video.pause();
      }
      
      // 是否在不可见时卸载视频源取决于优化策略
      if (this.options.unloadInvisible) {
        if (!video.dataset.src) {
          video.dataset.src = video.src;
        }
        video.removeAttribute('src');
        video.load(); // 释放视频资源
      }
    }
    
    // 使用占位符替换实际元素（如果启用）
    if (this.options.usePlaceholders) {
      if (!item.placeholder) {
        item.placeholder = this.createPlaceholder(item);
        if (item.element.parentNode) {
          item.element.parentNode.appendChild(item.placeholder);
        }
      }
      item.placeholder.style.display = '';
      item.element.style.display = 'none';
    }
  }
  
  // 创建占位符元素
  createPlaceholder(item) {
    const placeholder = document.createElement('div');
    placeholder.className = 'virtual-placeholder';
    placeholder.style.width = `${item.rect.width}px`;
    placeholder.style.height = `${item.rect.height}px`;
    placeholder.style.position = 'absolute';
    placeholder.style.top = `${item.rect.top}px`;
    placeholder.style.left = `${item.rect.left}px`;
    placeholder.style.background = '#2a2a2a';
    placeholder.style.borderRadius = '8px';
    
    return placeholder;
  }
  
  // 刷新所有元素的可见性
  refresh() {
    this.updateAllItemMetrics();
    this.updateVisibleItems();
  }
}

// 创建虚拟滚动管理器实例
let virtualScroller = null;

// 初始化虚拟滚动
function initVirtualScrolling() {
  if (PERFORMANCE_CONFIG.virtualScrolling && videoGrid) {
    if (virtualScroller) {
      virtualScroller.destroy();
    }
    
    virtualScroller = new VirtualScrollManager(videoGrid);
    
    // 刷新所有视频元素
    refreshVirtualScroller();
  }
}

// 刷新虚拟滚动管理器中的元素
function refreshVirtualScroller() {
  if (!virtualScroller) return;
  
  // 清空当前元素
  virtualScroller.clearItems();
  
  // 添加所有视频容器到虚拟滚动管理器
  const containers = document.querySelectorAll('.video-container');
  containers.forEach(container => {
    virtualScroller.addItem(container);
  });
  
  // 初始更新可见性
  virtualScroller.refresh();
}

// 刷新可见视频的方法
function refreshVisibleVideos() {
  if (virtualScroller) {
    virtualScroller.refresh();
  } else {
    // 如果没有启用虚拟滚动，则使用基本的懒加载
    basicLazyLoad();
  }
}

// 基本的懒加载实现
function basicLazyLoad() {
  const viewportTop = window.scrollY;
  const viewportBottom = viewportTop + window.innerHeight;
  const lazyDistance = PERFORMANCE_CONFIG.lazyLoadDistance;
  
  // 查找所有视频元素
  document.querySelectorAll('.video-container').forEach(container => {
    const rect = container.getBoundingClientRect();
    const elementTop = viewportTop + rect.top;
    const elementBottom = elementTop + rect.height;
    
    // 检查是否在扩展可视区域内
    const isVisible = !(elementBottom < viewportTop - lazyDistance || 
                         elementTop > viewportBottom + lazyDistance);
    
    // 处理视频元素的加载/卸载
    const video = container.querySelector('video');
    if (video) {
      if (isVisible) {
        // 视频在可视区域内，确保加载
        if (video.dataset.src && !video.src) {
          video.src = video.dataset.src;
          video.load();
        }
      } else {
        // 视频不在可视区域，可选择暂停和卸载
        if (!video.paused) {
          video.pause();
        }
        
        // 根据配置决定是否卸载不可见视频
        if (PERFORMANCE_CONFIG.unloadInvisible) {
          if (!video.dataset.src) {
            video.dataset.src = video.src;
          }
          video.removeAttribute('src');
          video.load(); // 释放视频资源
        }
      }
    }
  });
}

// 清理未使用的资源
function cleanupResources() {
  if (!isPageVisible) return;
  
  // 修改processVideoFiles函数，实现批量处理
  const originalProcessVideoFiles = processVideoFiles;
  processVideoFiles = function(files) {
    // 存储所有待处理的文件
    const allFiles = Array.from(files);
    setStatus(`处理 ${allFiles.length} 个文件，分批加载中...`);
    
    // 处理一批文件的函数
    const processBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + PERFORMANCE_CONFIG.batchSize, allFiles.length);
      const batch = allFiles.slice(startIndex, endIndex);
      
      if (batch.length === 0) {
        // 所有批次处理完成
        setStatus(`全部 ${allFiles.length} 个文件加载完成`);
        
        // 初始化虚拟滚动
        initVirtualScrolling();
        return;
      }
      
      // 更新状态
      setStatus(`处理第 ${startIndex + 1}-${endIndex} 个文件（共 ${allFiles.length} 个）...`);
      
      // 处理当前批次
      originalProcessVideoFiles(batch);
      
      // 调度下一批次处理
      setTimeout(() => {
        processBatch(endIndex);
      }, PERFORMANCE_CONFIG.processingDelay);
    };
    
    // 开始第一批处理
    processBatch(0);
  };

  // 修改createVideoElement函数，实现懒加载
  const originalCreateVideoElement = createVideoElement;
  createVideoElement = function(file, parentContainer) {
    const container = originalCreateVideoElement(file, parentContainer);
    
    // 找到视频元素
    const video = container.querySelector('video');
    if (video && PERFORMANCE_CONFIG.lazyLoad) {
      // 保存原始src到data属性
      video.dataset.src = video.src;
      video.removeAttribute('src');
      
      // 注册到视频注册表
      videoRegistry.set(video, {
        file: file,
        lastActive: Date.now()
      });
    }
    
    // 添加到虚拟滚动管理器
    if (virtualScroller) {
      virtualScroller.addItem(container);
    }
    
    return container;
  };
}

// 添加页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
  // 已有的DOMContentLoaded代码保持不变
  // 在末尾添加以下代码
  
  // 初始化性能优化
  cleanupResources();
  
  // 添加滚动事件监听
  window.addEventListener('scroll', function() {
    if (!virtualScroller) {
      refreshVisibleVideos();
    }
  }, { passive: true });
  
  // 设置定期清理定时器
  setInterval(function() {
    // 清理长时间不活跃的视频资源
    if (videoRegistry.size > 0) {
      const now = Date.now();
      const maxAge = 60000; // 1分钟不活跃则清理
      
      videoRegistry.forEach((info, video) => {
        if (now - info.lastActive > maxAge && !isElementInViewport(video)) {
          if (!video.paused) {
            video.pause();
          }
          
          if (video.src) {
            video.dataset.src = video.src;
            video.removeAttribute('src');
            video.load(); // 释放资源
            
            // 更新注册表
            info.lastActive = now - maxAge + 5000; // 给一个缓冲期
            videoRegistry.set(video, info);
          }
        }
      });
    }
  }, PERFORMANCE_CONFIG.cleanupInterval);
});

// 辅助函数：检查元素是否在视口内
function isElementInViewport(el) {
  if (!el || !el.getBoundingClientRect) return false;
  
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= -PERFORMANCE_CONFIG.lazyLoadDistance &&
    rect.left >= -PERFORMANCE_CONFIG.lazyLoadDistance &&
    rect.bottom <= (window.innerHeight + PERFORMANCE_CONFIG.lazyLoadDistance) &&
    rect.right <= (window.innerWidth + PERFORMANCE_CONFIG.lazyLoadDistance)
  );
}