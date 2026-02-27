// public/player.js

document.addEventListener('DOMContentLoaded', () => {
    const { createClient } = supabase;
    const supabaseClient = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

    // --- Element Caching ---
    const playerTitle = document.getElementById('playerTitle');
    const playerSubtitle = document.getElementById('playerSubtitle');
    const videoGrid = document.getElementById('videoGrid');
    const selectedCountEl = document.getElementById('selectedCount');

    // Controls
    const playAllBtn = document.getElementById('playAllBtn');
    const pauseAllBtn = document.getElementById('pauseAllBtn');
    const muteAllBtn = document.getElementById('muteAllBtn');
    const unmuteAllBtn = document.getElementById('unmuteAllBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const showSelectedBtn = document.getElementById('showSelectedBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const shareLinkBtn = document.getElementById('shareLinkBtn');
    const videosPerRowSlider = document.getElementById('videosPerRow');
    const videosPerRowValue = document.getElementById('videosPerRowValue');
    const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    const playbackSpeedBtns = document.querySelectorAll('.playback-speed-btn');
    const sortBySelect = document.getElementById('sortBy');

    // Compare mode elements
    const compareBtn = document.getElementById('compareBtn');
    const comparePanel = document.getElementById('comparePanel');
    const compareDatasetSelect = document.getElementById('compareDatasetSelect');
    const startCompareBtn = document.getElementById('startCompareBtn');
    const exitCompareBtn = document.getElementById('exitCompareBtn');
    const compareStatus = document.getElementById('compareStatus');

    let isShowingSelected = false;
    let isCompareMode = false;
    let currentDatasetId = null;
    
    // --- Core Functions ---
    const getVideos = (onlySelected = false) => {
        const selector = onlySelected ? '.video-item-container.selected' : '.video-item-container';
        return Array.from(videoGrid.querySelectorAll(selector));
    };

    const updateSelectedCount = () => {
        selectedCountEl.textContent = getVideos(true).length;
    };

    // Helper: get all <video> elements regardless of mode
    const getAllVideoEls = () => Array.from(videoGrid.querySelectorAll('video'));

    // --- Event Listeners ---
    playAllBtn.addEventListener('click', () => getAllVideoEls().forEach(v => v.play()));
    pauseAllBtn.addEventListener('click', () => getAllVideoEls().forEach(v => v.pause()));
    muteAllBtn.addEventListener('click', () => getAllVideoEls().forEach(v => v.muted = true));
    unmuteAllBtn.addEventListener('click', () => getAllVideoEls().forEach(v => v.muted = false));

    videosPerRowSlider.addEventListener('input', (e) => {
        videoGrid.style.setProperty('--videos-per-row', e.target.value);
        videosPerRowValue.textContent = e.target.value;
    });

    aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const ratio = btn.dataset.ratio;
            getVideos().forEach(v => {
                v.style.aspectRatio = ratio === 'auto' ? '' : ratio;
            });
            aspectRatioBtns.forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    playbackSpeedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed);
            getAllVideoEls().forEach(v => v.playbackRate = speed);
            playbackSpeedBtns.forEach(b => b.classList.toggle('active', b === btn));
        });
    });

    selectAllBtn.addEventListener('click', () => {
        getVideos().forEach(v => v.classList.add('selected'));
        updateSelectedCount();
    });

    deselectAllBtn.addEventListener('click', () => {
        getVideos().forEach(v => v.classList.remove('selected'));
        updateSelectedCount();
    });

    showSelectedBtn.addEventListener('click', () => {
        isShowingSelected = !isShowingSelected;
        showSelectedBtn.classList.toggle('active', isShowingSelected);
        showSelectedBtn.textContent = isShowingSelected ? '📋 Show All' : '📋 Show Selected';
        getVideos().forEach(v => {
            v.style.display = isShowingSelected && !v.classList.contains('selected') ? 'none' : 'block';
        });
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all videos from the grid? This is a client-side action.')) {
            videoGrid.innerHTML = '';
        }
    });

    shareLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link copied to clipboard!');
        }, () => {
            alert('Failed to copy link.');
        });
    });

    sortBySelect.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        const videos = getVideos();
        videos.sort((a, b) => {
            const nameA = a.dataset.fileName.toLowerCase();
            const nameB = b.dataset.fileName.toLowerCase();
            if (sortBy === 'name_asc') return nameA.localeCompare(nameB);
            if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
            return 0; // upload_order is default
        });
        videoGrid.innerHTML = '';
        videos.forEach(v => videoGrid.appendChild(v));
    });

    // --- Data Loading ---
    async function loadAndDisplayDataset(datasetId) {
        try {
            playerTitle.textContent = 'Loading dataset...';
            const [datasetRes, videosRes] = await Promise.all([
                supabaseClient.from('datasets').select('name').eq('id', datasetId).single(),
                supabaseClient.from('videos').select('public_url, file_name').eq('dataset_id', datasetId).order('created_at')
            ]);
            
            if (datasetRes.error) throw datasetRes.error;
            if (videosRes.error) throw videosRes.error;
            playerTitle.textContent = datasetRes.data.name;
            playerSubtitle.textContent = `Found ${videosRes.data.length} videos.`;
            videoGrid.innerHTML = '';
            videosRes.data.forEach(video => {
                videoGrid.appendChild(createPlayerVideoElement(video));
            });

            // Autoplay if requested in URL
            const currentUrlParams = new URLSearchParams(window.location.search);
            if (currentUrlParams.get('autoplay') === 'true') {
                setTimeout(() => {
                    console.log("Attempting to autoplay videos...");
                    getVideos().forEach(v => {
                        const videoEl = v.querySelector('video');
                        if (videoEl) {
                            const playPromise = videoEl.play();
                            if (playPromise !== undefined) {
                                playPromise.catch(error => {
                                    console.warn('Autoplay was prevented for:', videoEl.src, error);
                                });
                            }
                        }
                    });
                }, 500);
            }
        } catch (error) {
            console.error('Failed to load dataset:', error);
            playerTitle.textContent = 'Failed to load';
            playerSubtitle.textContent = error.message;
        }
    }

    function createPlayerVideoElement(videoData) {
        const container = document.createElement('div');
        container.className = 'video-item-container';
        container.dataset.fileName = videoData.file_name;

        const video = document.createElement('video');
        video.src = videoData.public_url;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;
        video.title = videoData.file_name;
        video.setAttribute('preload', 'metadata');

        container.appendChild(video);

        const nameLabel = document.createElement('div');
        nameLabel.className = 'video-filename';
        nameLabel.textContent = videoData.file_name;
        container.appendChild(nameLabel);

        container.addEventListener('click', () => {
            container.classList.toggle('selected');
            updateSelectedCount();
        });

        return container;
    }

    // --- Compare Mode ---

    // Load all datasets into the compare selector dropdown
    async function loadDatasetOptions(excludeId) {
        try {
            const { data: datasets, error } = await supabaseClient
                .from('datasets')
                .select('id, name')
                .order('created_at', { ascending: false });
            if (error) throw error;

            compareDatasetSelect.innerHTML = '<option value="">-- Select a dataset --</option>';
            datasets.forEach(ds => {
                if (ds.id !== excludeId) {
                    const option = document.createElement('option');
                    option.value = ds.id;
                    option.textContent = ds.name;
                    compareDatasetSelect.appendChild(option);
                }
            });
        } catch (err) {
            console.error('Failed to load datasets for compare:', err);
        }
    }

    // Toggle compare panel visibility
    compareBtn.addEventListener('click', () => {
        if (isCompareMode) {
            exitCompareMode();
            return;
        }
        const isHidden = comparePanel.classList.contains('hidden');
        comparePanel.classList.toggle('hidden', !isHidden);
        if (isHidden && currentDatasetId) {
            loadDatasetOptions(currentDatasetId);
        }
    });

    // Start compare
    startCompareBtn.addEventListener('click', () => {
        const compareId = compareDatasetSelect.value;
        if (!compareId) {
            alert('Please select a dataset to compare with.');
            return;
        }
        if (!currentDatasetId) {
            alert('No base dataset loaded.');
            return;
        }
        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('compare', compareId);
        window.history.pushState({}, '', url);

        loadCompareMode(currentDatasetId, compareId);
    });

    // Exit compare mode
    exitCompareBtn.addEventListener('click', exitCompareMode);

    function exitCompareMode() {
        isCompareMode = false;
        comparePanel.classList.add('hidden');
        compareBtn.textContent = '⚡ Compare';
        compareStatus.textContent = '';

        // Remove compare param from URL
        const url = new URL(window.location);
        url.searchParams.delete('compare');
        window.history.pushState({}, '', url);

        // Reload normal mode
        if (currentDatasetId) {
            loadAndDisplayDataset(currentDatasetId);
        }
    }

    // Core compare logic: load two datasets, match by filename, render pairs
    async function loadCompareMode(datasetIdA, datasetIdB) {
        try {
            isCompareMode = true;
            compareBtn.textContent = '⚡ Comparing...';
            comparePanel.classList.remove('hidden');
            videoGrid.innerHTML = '<p class="text-gray-400">Loading compare data...</p>';

            // Load both datasets in parallel
            const [resA, resB, metaA, metaB] = await Promise.all([
                supabaseClient.from('videos').select('public_url, file_name').eq('dataset_id', datasetIdA).order('created_at'),
                supabaseClient.from('videos').select('public_url, file_name').eq('dataset_id', datasetIdB).order('created_at'),
                supabaseClient.from('datasets').select('name').eq('id', datasetIdA).single(),
                supabaseClient.from('datasets').select('name').eq('id', datasetIdB).single(),
            ]);

            if (resA.error) throw resA.error;
            if (resB.error) throw resB.error;

            const nameA = metaA.data?.name || 'Dataset A';
            const nameB = metaB.data?.name || 'Dataset B';

            playerTitle.textContent = `Compare: ${nameA} vs ${nameB}`;

            // Match by file_name using Map for O(1) lookup
            const mapA = new Map();
            resA.data.forEach(v => mapA.set(v.file_name, v));

            const matched = [];
            const unmatchedB = [];

            resB.data.forEach(v => {
                if (mapA.has(v.file_name)) {
                    matched.push({
                        fileName: v.file_name,
                        videoA: mapA.get(v.file_name),
                        videoB: v,
                    });
                    mapA.delete(v.file_name);
                } else {
                    unmatchedB.push(v);
                }
            });

            const unmatchedA = Array.from(mapA.values());

            // Sort matched pairs by filename
            matched.sort((a, b) => a.fileName.localeCompare(b.fileName));

            playerSubtitle.textContent = `${matched.length} matched, ${unmatchedA.length + unmatchedB.length} unmatched`;
            compareStatus.textContent = `Matched: ${matched.length} pairs | Unmatched A: ${unmatchedA.length} | Unmatched B: ${unmatchedB.length}`;

            // Auto-adjust grid to 2 columns for compare pairs (each pair already has 2 videos)
            videosPerRowSlider.value = 2;
            videosPerRowValue.textContent = '2';
            videoGrid.style.setProperty('--videos-per-row', '2');

            renderComparePairs(matched, unmatchedA, unmatchedB, nameA, nameB);
            compareBtn.textContent = '⚡ Compare (Active)';

        } catch (err) {
            console.error('Compare mode error:', err);
            playerTitle.textContent = 'Compare failed';
            playerSubtitle.textContent = err.message;
            videoGrid.innerHTML = '';
        }
    }

    // Render matched pairs and unmatched files
    function renderComparePairs(matched, unmatchedA, unmatchedB, nameA, nameB) {
        videoGrid.innerHTML = '';

        // Render matched pairs
        matched.forEach(pair => {
            const pairDiv = document.createElement('div');
            pairDiv.className = 'compare-pair';

            // Title
            const title = document.createElement('div');
            title.className = 'compare-pair-title';
            title.textContent = pair.fileName;
            pairDiv.appendChild(title);

            // Side by side container
            const sbs = document.createElement('div');
            sbs.className = 'compare-side-by-side';

            sbs.appendChild(createCompareItem(pair.videoA, nameA, 'label-a'));
            sbs.appendChild(createCompareItem(pair.videoB, nameB, 'label-b'));

            pairDiv.appendChild(sbs);
            videoGrid.appendChild(pairDiv);
        });

        // Render unmatched files
        if (unmatchedA.length > 0 || unmatchedB.length > 0) {
            const section = document.createElement('div');
            section.className = 'compare-unmatched-section';

            const sectionTitle = document.createElement('div');
            sectionTitle.className = 'compare-unmatched-title';
            sectionTitle.textContent = `Unmatched files (${unmatchedA.length + unmatchedB.length})`;
            section.appendChild(sectionTitle);

            const unmatchedGrid = document.createElement('div');
            unmatchedGrid.className = 'video-grid';
            unmatchedGrid.style.setProperty('--videos-per-row', videosPerRowSlider.value);

            unmatchedA.forEach(v => {
                const container = createPlayerVideoElement(v);
                container.title = `[${nameA}] ${v.file_name}`;
                unmatchedGrid.appendChild(container);
            });
            unmatchedB.forEach(v => {
                const container = createPlayerVideoElement(v);
                container.title = `[${nameB}] ${v.file_name}`;
                unmatchedGrid.appendChild(container);
            });

            section.appendChild(unmatchedGrid);
            videoGrid.appendChild(section);
        }
    }

    // Create a single compare item (one side of a pair)
    function createCompareItem(videoData, label, labelClass) {
        const item = document.createElement('div');
        item.className = 'compare-item';

        const labelDiv = document.createElement('div');
        labelDiv.className = `compare-label ${labelClass}`;
        labelDiv.textContent = label;
        item.appendChild(labelDiv);

        const video = document.createElement('video');
        video.src = videoData.public_url;
        video.controls = true;
        video.muted = true;
        video.playsInline = true;
        video.title = videoData.file_name;
        video.setAttribute('preload', 'metadata');
        item.appendChild(video);

        return item;
    }

    // --- Initial Load ---
    const urlParams = new URLSearchParams(window.location.search);
    const datasetId = urlParams.get('dataset');
    const compareId = urlParams.get('compare');

    if (datasetId) {
        currentDatasetId = datasetId;
        if (compareId) {
            // Load compare mode directly from URL (skip normal render)
            loadCompareMode(datasetId, compareId);
        } else {
            loadAndDisplayDataset(datasetId);
        }
    } else {
        playerTitle.textContent = 'No dataset selected';
        playerSubtitle.textContent = 'Please select a dataset from the management page.';
    }
}); 