const dropZone = document.getElementById('dropZone');
const videoGrid = document.getElementById('videoGrid');
const currentCount = document.getElementById('currentCount');
const MAX_VIDEOS = 1000;
const downloadAllButton = document.getElementById('downloadAll');
const folderSelectButton = document.getElementById('folderSelect');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Handle drag enter/leave visual feedback
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
  dropZone.classList.add('dragover');
}

function unhighlight(e) {
  dropZone.classList.remove('dragover');
}

// Handle dropped files
dropZone.addEventListener('drop', handleDrop, false);

// 处理文件夹选择按钮点击事件
folderSelectButton.addEventListener('click', handleFolderSelect, false);

function handleFolderSelect() {
  // 创建一个隐藏的文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.webkitdirectory = true; // 允许选择文件夹
  fileInput.directory = true; // Firefox支持
  fileInput.multiple = true;
  
  // 监听文件选择事件
  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    
    // 筛选视频文件
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    
    // 计算还能添加多少视频
    const currentVideoCount = videoGrid.children.length;
    const remainingSlots = MAX_VIDEOS - currentVideoCount;
    
    if (remainingSlots <= 0) {
      alert('已达到最大视频数量限制');
      return;
    }
    
    // 限制添加数量
    const filesToProcess = videoFiles.slice(0, remainingSlots);
    
    // 如果没有发现视频文件
    if (filesToProcess.length === 0) {
      alert('所选文件夹中未找到视频文件');
      return;
    }
    
    // 处理每个视频文件
    filesToProcess.forEach(file => {
      createVideoElement(file);
    });
    
    // 显示添加了多少视频
    alert(`成功添加 ${filesToProcess.length} 个视频文件`);
  });
  
  // 触发文件选择对话框
  fileInput.click();
}

function updateVideoCount() {
  const count = videoGrid.children.length;
  currentCount.textContent = count;
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  
  // 处理文件和文件夹
  if (dt.items) {
    // 使用DataTransferItemList接口处理文件夹
    handleDropItems(Array.from(dt.items));
  } else {
    // 如果浏览器不支持items，则只处理文件
    const files = [...dt.files];
    processVideoFiles(files);
  }
}

// 处理拖放的items（可能包含文件夹）
async function handleDropItems(items) {
  const allFiles = [];
  
  // 递归处理所有项目
  const promises = items.map(async (item) => {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : item.getAsEntry();
      
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
        const file = await getAsFile(item);
        if (file) allFiles.push(file);
      }
    }
  });
  
  // 等待所有文件处理完成
  await Promise.all(promises);
  
  // 处理所有收集到的文件
  processVideoFiles(allFiles);
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
  // 筛选视频文件
  const videoFiles = files.filter(file => file.type.startsWith('video/'));
  
  // 计算还能添加多少视频
  const currentVideoCount = videoGrid.children.length;
  const remainingSlots = MAX_VIDEOS - currentVideoCount;
  
  if (remainingSlots <= 0) {
    alert('已达到最大视频数量限制');
    return;
  }
  
  // 限制添加数量
  const filesToProcess = videoFiles.slice(0, remainingSlots);
  
  if (filesToProcess.length > 0) {
    filesToProcess.forEach(file => {
      createVideoElement(file);
    });
    
    // 当文件较多时提示添加成功
    if (filesToProcess.length > 1) {
      alert(`成功添加 ${filesToProcess.length} 个视频文件`);
    }
  } else if (files.length > 0) {
    // 当有文件但没有视频文件时提示
    alert('未找到有效的视频文件');
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