const dropZone = document.getElementById('dropZone');
const videoGrid = document.getElementById('videoGrid');
const currentCount = document.getElementById('currentCount');
const MAX_VIDEOS = 1000;
const downloadAllButton = document.getElementById('downloadAll');
const folderSelectButton = document.getElementById('folderSelect');
const statusText = document.getElementById('statusText');
const toastContainer = document.getElementById('toastContainer');

// 显示Toast提示
function showToast(message, type = 'info', duration = 3000) {
  // 创建Toast元素
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // 添加到容器
  toastContainer.appendChild(toast);
  
  // 显示动画
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // 自动移除
  setTimeout(() => {
    toast.classList.remove('show');
    // 移除元素
    setTimeout(() => {
      toast.remove();
    }, 300); // 等待淡出动画完成
  }, duration);
  
  // 同时记录到控制台
  console.log(`Toast (${type}):`, message);
}

// 设置状态文本的辅助函数
function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? '#ef4444' : '#9ca3af';
  console.log(isError ? 'Error: ' : 'Status: ', message);
}

// 支持的媒体类型
const SUPPORTED_TYPES = {
  video: ['video/'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
};

// 确保DOM元素已加载
document.addEventListener('DOMContentLoaded', function() {
  setStatus('页面已加载，等待媒体文件...');

  // 确保我们有所有需要的元素
  if (!dropZone) {
    console.error('找不到拖放区域元素');
    return;
  }

  // 设置拖放事件
  initDragAndDrop();
});

// 初始化拖放功能
function initDragAndDrop() {
  // 直接在HTML元素上添加事件
  dropZone.addEventListener('dragenter', function(e) {
    e.preventDefault();
    e.stopPropagation();
    setStatus('文件拖放中...');
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
    setStatus('处理拖放的文件...');
    
    handleDrop(e);
  }, false);

  // 添加点击来触发文件选择
  dropZone.addEventListener('click', function(e) {
    // 如果点击的不是按钮而是拖放区域，则触发文件选择
    if (e.target !== folderSelectButton && !e.target.closest('#folderSelect')) {
      handleFolderSelect();
    }
  });

  setStatus('拖放功能已初始化');
}

// 预防默认行为的函数 - 用于整个文档
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.body.addEventListener(eventName, function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

// 处理文件夹选择按钮点击事件
folderSelectButton.addEventListener('click', handleFolderSelect, false);

function handleFolderSelect() {
  // 创建一个隐藏的文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.webkitdirectory = true; // 允许选择文件夹
  fileInput.directory = true; // Firefox支持
  fileInput.multiple = true;
  
  setStatus('打开文件夹选择对话框...');
  
  // 监听文件选择事件
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    setStatus(`检测到 ${files.length} 个文件，筛选媒体文件...`);
    
    // 筛选媒体文件
    const mediaFiles = files.filter(file => {
      return SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
             SUPPORTED_TYPES.image.some(type => file.type === type);
    });
    
    // 计算还能添加多少媒体文件
    const currentMediaCount = videoGrid.children.length;
    const remainingSlots = MAX_VIDEOS - currentMediaCount;
    
    if (remainingSlots <= 0) {
      setStatus('已达到最大媒体文件数量限制', true);
      showToast('已达到最大媒体文件数量限制', 'error');
      return;
    }
    
    // 限制添加数量
    const filesToProcess = mediaFiles.slice(0, remainingSlots);
    
    // 如果没有发现媒体文件
    if (filesToProcess.length === 0) {
      setStatus('所选文件夹中未找到视频或图片文件', true);
      showToast('所选文件夹中未找到视频或图片文件', 'error');
      return;
    }
    
    setStatus(`处理 ${filesToProcess.length} 个媒体文件...`);
    
    // 处理每个媒体文件
    filesToProcess.forEach(file => {
      if (SUPPORTED_TYPES.video.some(type => file.type.startsWith(type))) {
        createVideoElement(file);
      } else if (SUPPORTED_TYPES.image.some(type => file.type === type)) {
        createImageElement(file);
      }
    });
    
    setStatus(`成功添加 ${filesToProcess.length} 个媒体文件`);
    // 显示添加了多少媒体文件
    showToast(`成功添加 ${filesToProcess.length} 个媒体文件`, 'success');
  });
  
  // 触发文件选择对话框
  fileInput.click();
}

function updateVideoCount() {
  const count = videoGrid.children.length;
  currentCount.textContent = count;
}

// 将handleDrop函数修改为使用Toast
function handleDrop(e) {
  setStatus('开始处理拖放文件...');
  try {
    const dt = e.dataTransfer;
    
    // 首先尝试最简单的方法 - 直接获取文件
    if (dt.files && dt.files.length > 0) {
      setStatus(`检测到 ${dt.files.length} 个文件，处理中...`);
      processVideoFiles(Array.from(dt.files));
      return;
    }
    
    // 如果没有文件或需要处理文件夹，尝试items API
    if (dt.items && dt.items.length > 0) {
      setStatus(`检测到 ${dt.items.length} 个项目，使用高级API处理...`);
      
      // 直接提取所有文件，不考虑文件夹结构
      const files = [];
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        setStatus(`找到 ${files.length} 个顶级文件`);
        processVideoFiles(files);
        
        // 尝试使用高级API处理可能的文件夹
        try {
          handleDropItems(Array.from(dt.items));
        } catch (innerError) {
          console.error('高级文件夹处理失败:', innerError);
          // 已经处理了顶级文件，所以继续
        }
      } else {
        setStatus('没有找到文件，尝试处理文件夹...', true);
        // 尝试使用高级API
        handleDropItems(Array.from(dt.items));
      }
    } else {
      setStatus('没有检测到文件或文件夹', true);
      showToast('没有检测到文件或文件夹', 'error');
    }
  } catch (error) {
    console.error('处理拖放时出错:', error);
    setStatus('拖放处理失败，请尝试使用"选择本地文件夹"按钮', true);
    showToast('拖放处理失败，请尝试使用"选择本地文件夹"按钮', 'error');
  }
}

// 处理拖放的items（可能包含文件夹）
async function handleDropItems(items) {
  const allFiles = [];
  
  // 递归处理所有项目
  const promises = items.map(async (item) => {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item.getAsEntry ? item.getAsEntry() : null);
      
      if (entry) {
        // 如果是文件夹
        if (entry.isDirectory) {
          const dirFiles = await readDirectoryEntries(entry);
          allFiles.push(...dirFiles);
        }
        // 如果是文件
        else if (entry.isFile) {
          const file = await getFileFromEntry(entry);
          if (file) allFiles.push(file);
        }
      } else {
        // 如果不支持entry API，直接获取文件
        const file = item.getAsFile();
        if (file) allFiles.push(file);
      }
    }
  });
  
  try {
    // 等待所有文件处理完成
    await Promise.all(promises);
    
    // 处理所有收集到的文件
    processVideoFiles(allFiles);
  } catch (error) {
    console.error('处理拖放项目时出错:', error);
    // 降级处理：如果高级API失败，尝试基本的文件处理
    const files = items.map(item => item.getAsFile()).filter(file => file !== null);
    processVideoFiles(files);
  }
}

// 从文件夹条目读取所有文件
async function readDirectoryEntries(dirEntry) {
  const files = [];
  
  // 读取目录内容
  const readEntries = (dirReader) => {
    return new Promise((resolve) => {
      dirReader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve();
          return;
        }
        
        // 处理每个条目
        const entryPromises = entries.map(async (entry) => {
          if (entry.isDirectory) {
            // 递归读取子目录
            const subFiles = await readDirectoryEntries(entry);
            files.push(...subFiles);
          } else if (entry.isFile) {
            // 添加文件
            const file = await getFileFromEntry(entry);
            if (file) files.push(file);
          }
        });
        
        await Promise.all(entryPromises);
        
        // 递归读取更多条目（目录可能一次读不完）
        await readEntries(dirReader);
      }, (error) => {
        console.error('读取目录出错:', error);
        resolve();
      });
    });
  };
  
  await readEntries(dirEntry.createReader());
  return files;
}

// 从文件条目获取File对象
function getFileFromEntry(fileEntry) {
  return new Promise((resolve) => {
    fileEntry.file((file) => {
      resolve(file);
    }, (error) => {
      console.error('获取文件出错:', error);
      resolve(null);
    });
  });
}

// 从DataTransferItem获取文件
function getAsFile(item) {
  return new Promise((resolve) => {
    const file = item.getAsFile();
    resolve(file);
  });
}

// 处理视频文件
function processVideoFiles(files) {
  // 筛选视频和图片文件
  const mediaFiles = files.filter(file => {
    return SUPPORTED_TYPES.video.some(type => file.type.startsWith(type)) || 
           SUPPORTED_TYPES.image.some(type => file.type === type);
  });
  
  // 计算还能添加多少媒体文件
  const currentCount = videoGrid.children.length;
  const remainingSlots = MAX_VIDEOS - currentCount;
  
  if (remainingSlots <= 0) {
    showToast('已达到最大媒体文件数量限制', 'error');
    return;
  }
  
  // 限制添加数量
  const filesToProcess = mediaFiles.slice(0, remainingSlots);
  
  if (filesToProcess.length > 0) {
    filesToProcess.forEach(file => {
      if (SUPPORTED_TYPES.video.some(type => file.type.startsWith(type))) {
        createVideoElement(file);
      } else if (SUPPORTED_TYPES.image.some(type => file.type === type)) {
        createImageElement(file);
      }
    });
    
    // 当文件较多时提示添加成功
    if (filesToProcess.length > 1) {
      showToast(`成功添加 ${filesToProcess.length} 个媒体文件`, 'success');
    } else if (filesToProcess.length === 1) {
      showToast(`成功添加文件: ${filesToProcess[0].name}`, 'success');
    }
  } else if (files.length > 0) {
    // 当有文件但没有支持的媒体文件时提示
    showToast('未找到有效的视频或图片文件', 'error');
  }
}

function createVideoElement(file) {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  
  // Add mouse enter/leave event listeners for audio control
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
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  videoWrapper.appendChild(video);
  videoContainer.appendChild(removeButton);
  videoContainer.appendChild(videoWrapper);
  videoInfo.appendChild(filename);
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

// 创建图片元素
function createImageElement(file) {
  const imageContainer = document.createElement('div');
  imageContainer.className = 'video-container';
  
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
    URL.revokeObjectURL(image.src); // 清理对象URL
    updateVideoCount();
    updateDownloadButtonState();
  });
  
  const imageInfo = document.createElement('div');
  imageInfo.className = 'video-info';
  
  const filename = document.createElement('div');
  filename.className = 'video-filename';
  filename.textContent = file.name;
  
  imageWrapper.appendChild(image);
  imageContainer.appendChild(removeButton);
  imageContainer.appendChild(imageWrapper);
  imageInfo.appendChild(filename);
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
    const filename = container.querySelector('.video-filename').textContent;
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = video.src;
    a.download = filename; // Use original filename
    
    // Trigger download with a small delay between each file
    setTimeout(() => {
      a.click();
    }, index * 500); // 500ms delay between each download
  });
}