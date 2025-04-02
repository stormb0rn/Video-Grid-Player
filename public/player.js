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
  // Directly add events to HTML element
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

  // Add click to trigger file selection
  dropZone.addEventListener('click', function(e) {
    // If click is not on the button but on the drop zone, trigger folder select
    if (e.target !== folderSelectButton && !e.target.closest('#folderSelect')) {
      handleFolderSelect();
    }
  });

  setStatus('Drag and drop initialized');
}

// Prevent default actions for document
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.body.addEventListener(eventName, function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

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
    // Show how many media files were added
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
    
    // First try the simplest method - directly get files
    if (dt.files && dt.files.length > 0) {
      setStatus(`Detected ${dt.files.length} files, processing...`);
      processVideoFiles(Array.from(dt.files));
      return;
    }
    
    // If no files or we need to process folders, try items API
    if (dt.items && dt.items.length > 0) {
      setStatus(`Detected ${dt.items.length} items, using advanced API...`);
      
      // Extract all files directly, regardless of folder structure
      const files = [];
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        setStatus(`Found ${files.length} top-level files`);
        processVideoFiles(files);
        
        // Try to use advanced API to handle potential folders
        try {
          handleDropItems(Array.from(dt.items));
        } catch (innerError) {
          console.error('Advanced folder processing failed:', innerError);
          // Already processed top-level files, so continue
        }
      } else {
        setStatus('No files found, trying to process folders...', true);
        // Try to use advanced API
        handleDropItems(Array.from(dt.items));
      }
    } else {
      setStatus('No files or folders detected', true);
      showToast('No files or folders detected', 'error');
    }
  } catch (error) {
    console.error('Error processing drop:', error);
    setStatus('Drop processing failed, try using the "Select Folder" button', true);
    showToast('Drop processing failed, try using the "Select Folder" button', 'error');
  }
}

// Handle dropped items (possibly containing folders)
async function handleDropItems(items) {
  const allFiles = [];
  
  // Process all items recursively
  const promises = items.map(async (item) => {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item.getAsEntry ? item.getAsEntry() : null);
      
      if (entry) {
        // If it's a folder
        if (entry.isDirectory) {
          const dirFiles = await readDirectoryEntries(entry);
          allFiles.push(...dirFiles);
        }
        // If it's a file
        else if (entry.isFile) {
          const file = await getFileFromEntry(entry);
          if (file) allFiles.push(file);
        }
      } else {
        // If entry API not supported, get file directly
        const file = item.getAsFile();
        if (file) allFiles.push(file);
      }
    }
  });
  
  try {
    // Wait for all file processing to complete
    await Promise.all(promises);
    
    // Process all collected files
    processVideoFiles(allFiles);
  } catch (error) {
    console.error('Error processing dropped items:', error);
    // Fallback handling: if advanced API fails, try basic file processing
    const files = items.map(item => item.getAsFile()).filter(file => file !== null);
    processVideoFiles(files);
  }
}

// Read entries from a directory
async function readDirectoryEntries(dirEntry) {
  const files = [];
  
  // Read directory contents
  const readEntries = (dirReader) => {
    return new Promise((resolve) => {
      dirReader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve();
          return;
        }
        
        // Process each entry
        const entryPromises = entries.map(async (entry) => {
          if (entry.isDirectory) {
            // Recursively read subdirectories
            const subFiles = await readDirectoryEntries(entry);
            files.push(...subFiles);
          } else if (entry.isFile) {
            // Add file
            const file = await getFileFromEntry(entry);
            if (file) files.push(file);
          }
        });
        
        await Promise.all(entryPromises);
        
        // Recursively read more entries (directory might not be read completely in one go)
        await readEntries(dirReader);
      }, (error) => {
        console.error('Error reading directory:', error);
        resolve();
      });
    });
  };
  
  await readEntries(dirEntry.createReader());
  return files;
}

// Get File object from file entry
function getFileFromEntry(fileEntry) {
  return new Promise((resolve) => {
    fileEntry.file((file) => {
      resolve(file);
    }, (error) => {
      console.error('Error getting file:', error);
      resolve(null);
    });
  });
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
    URL.revokeObjectURL(image.src); // Clean up the object URL
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