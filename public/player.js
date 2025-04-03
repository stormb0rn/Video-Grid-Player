const dropZone = document.getElementById('dropZone');
const videoGrid = document.getElementById('videoGrid');
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

// 用于存储文件树结构
let fileTreeStructure = null;

// Ensure DOM elements are loaded
document.addEventListener('DOMContentLoaded', function() {
  setStatus('Page loaded, waiting for media files...');

  // Ensure we have all required elements
  if (!dropZone) {
    console.error('Drop zone element not found');
    return;
  }

  // Set up drag and drop events
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
  const count = videoGrid.children.length;
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
    expanded: true,
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
        expanded: true,
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
      
      // 渲染文件树结构
      renderFileTree(fileTreeStructure);
      
      // 处理所有收集到的媒体文件
      processVideoFiles(allFiles);
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
      folderItem.className = 'tree-item folder' + (node.expanded ? ' expanded' : '');
      
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
      
      // 组装目录标题
      folderTitle.appendChild(expandIcon);
      folderTitle.appendChild(folderIcon);
      folderTitle.appendChild(folderName);
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
  const containers = Array.from(videoGrid.querySelectorAll('.video-container'));
  const targetContainer = containers.find(container => container.dataset.path === path);
  
  if (targetContainer) {
    // 滚动到目标容器
    targetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 添加高亮效果
    targetContainer.classList.add('highlight');
    setTimeout(() => {
      targetContainer.classList.remove('highlight');
    }, 2000);
  }
}

// Process video files
function processVideoFiles(files) {
  // Filter video and image files
  const mediaFiles = files.filter(file => {
    return SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
           SUPPORTED_TYPES.image.some(type => file.type === type);
  });
  
  // Calculate how many more media files we can add
  const currentCount = videoGrid.children.length;
  const remainingSlots = MAX_VIDEOS - currentCount;
  
  if (remainingSlots <= 0) {
    showToast('Maximum file limit reached', 'error');
    return;
  }
  
  // Limit to remaining slots
  const filesToProcess = mediaFiles.slice(0, remainingSlots);
  
  if (filesToProcess.length > 0) {
    filesToProcess.forEach(file => {
      if (SUPPORTED_TYPES.video.some(type => file.type.startsWith(type))) {
        createVideoElement(file);
      } else if (SUPPORTED_TYPES.image.some(type => file.type === type)) {
        createImageElement(file);
      }
    });
    
    // Show success message for multi-file addition
    if (filesToProcess.length > 1) {
      showToast(`Successfully added ${filesToProcess.length} media files`, 'success');
    } else if (filesToProcess.length === 1) {
      showToast(`Added file: ${filesToProcess[0].name}`, 'success');
    }
  } else if (files.length > 0) {
    // Message if files but no supported media
    showToast('No videos or images found', 'error');
  }
}

function createVideoElement(file) {
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
      
      pathTag.textContent = displayPath;
      videoInfo.appendChild(pathTag);
    }
  }
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  videoWrapper.appendChild(video);
  videoContainer.appendChild(removeButton);
  videoContainer.appendChild(videoWrapper);
  videoInfo.appendChild(filename);
  
  // 添加完整路径显示在文件名下方
  if (file.fullPath) {
    const pathElement = document.createElement('div');
    pathElement.className = 'video-path';
    // 显示父目录路径，不包括文件名
    const pathParts = file.fullPath.split('/');
    pathParts.pop(); // 移除文件名
    const directoryPath = pathParts.join('/') || '/';
    pathElement.textContent = directoryPath;
    videoInfo.appendChild(pathElement);
  }
  
  videoContainer.appendChild(videoInfo);
  videoGrid.appendChild(videoContainer);
  
  updateVideoCount();
  updateDownloadButtonState();
  
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
}

function createImageElement(file) {
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
      
      pathTag.textContent = displayPath;
      imageInfo.appendChild(pathTag);
    }
  }
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  imageWrapper.appendChild(image);
  imageContainer.appendChild(removeButton);
  imageContainer.appendChild(imageWrapper);
  imageInfo.appendChild(filename);
  
  // 添加路径显示
  if (file.fullPath) {
    const pathElement = document.createElement('div');
    pathElement.className = 'video-path';
    // 显示父目录路径，不包括文件名
    const pathParts = file.fullPath.split('/');
    pathParts.pop(); // 移除文件名
    const directoryPath = pathParts.join('/') || '/';
    pathElement.textContent = directoryPath;
    imageInfo.appendChild(pathElement);
  }
  
  imageContainer.appendChild(imageInfo);
  videoGrid.appendChild(imageContainer);
  
  updateVideoCount();
  updateDownloadButtonState();
}

// Initialize video count
updateVideoCount();
downloadAllButton.addEventListener('click', handleDownloadAll);
updateDownloadButtonState();

function updateDownloadButtonState() {
  const hasVideos = videoGrid.children.length > 0;
  downloadAllButton.disabled = !hasVideos;
}

function handleDownloadAll() {
  const videos = videoGrid.querySelectorAll('.video-container');
  
  videos.forEach((container, index) => {
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
    expanded: true,
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
          expanded: true,
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
  
  // 如果路径非常长，缩短显示
  if (cleanPath.length > 30) {
    const parts = cleanPath.split('/');
    
    if (parts.length <= 2) {
      // 只有一两级目录时显示全部
      return `📂 ${cleanPath}`;
    } else {
      // 多级目录时显示首尾，中间用...代替
      const firstDir = parts[0];
      const lastDir = parts[parts.length - 1];
      return `📂 ${firstDir}/.../${lastDir}`;
    }
  }
  
  // 路径不长时直接显示
  return `📂 ${cleanPath}`;
}