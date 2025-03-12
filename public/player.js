const dropZone = document.getElementById('dropZone');
const videoGrid = document.getElementById('videoGrid');
const currentCount = document.getElementById('currentCount');
const MAX_VIDEOS = 100;
const downloadAllButton = document.getElementById('downloadAll');

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

function updateVideoCount() {
  const count = videoGrid.children.length;
  currentCount.textContent = count;
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = [...dt.files];
  
  // Filter for video files only
  const videoFiles = files.filter(file => file.type.startsWith('video/'));
  
  // Calculate how many more videos we can add
  const currentVideoCount = videoGrid.children.length;
  const remainingSlots = MAX_VIDEOS - currentVideoCount;
  
  if (remainingSlots <= 0) {
    alert('Maximum video limit reached');
    return;
  }
  
  // Limit to remaining slots
  const filesToProcess = videoFiles.slice(0, remainingSlots);
  
  filesToProcess.forEach(file => {
    createVideoElement(file);
  });
}

function createVideoElement(file) {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  
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