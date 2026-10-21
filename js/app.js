/**
 * LazySloth Cleaner - Main Application Controller
 * 
 * Orchestrates:
 * - Mascot animation states & contextual speech
 * - Tab navigation and routing
 * - Local photo file picking & SHA-256 duplicate detection
 * - Transparent email & SMS demo interfaces
 * - Synchronized review queue & safe sweep confirmation
 * - Accessibility (Reduced Motion) & honest settings
 */

(function () {
    'use strict';

    // Application state
    const AppState = {
        currentTab: 'home',
        inboxSubTab: 'email',
        photoFilter: 'all',
        isScanning: false,
        reducedMotion: false,
        detector: null,
        gemmaService: null,
        reviewStore: null
    };

    // Sloth Speech Script
    const SlothSpeeches = {
        home: "Oh, hiiii! Ready to make a little room? Stay cozy, I'll sweep!",
        photos: "Pick some local images! I'll check for byte-for-byte exact duplicates with SHA-256.",
        inboxEmail: "No email account connected. Review sample clutter or inspect connection rules.",
        inboxSms: "Browser sandboxes protect SMS privacy. Here is sample clutter to inspect.",
        review: "Review items before sweeping. Nothing leaves your device or is deleted without your approval.",
        settings: "Local mode active. Honest statuses only—no pretend cloud connections!",
        scanning: "Sweeping digital dust and calculating SHA-256 hashes... gently, gently...",
        celebrate: "Yayyy! Clutter swept from the review queue! Time for a cozy nap."
    };

    // Initialize dependencies
    function initServices() {
        AppState.detector = window.LazySlothDuplicateDetector;
        AppState.gemmaService = new window.LazySlothGemmaService.GemmaClassifierService();
        AppState.reviewStore = new window.LazySlothReviewStore.ReviewStore();

        // Subscribe UI updates to review store changes
        AppState.reviewStore.subscribe((items, summary) => {
            renderReviewView(items, summary);
            updateGlobalBadges(summary);
            // If current tab is photos or inbox, re-render to reflect checked states
            if (AppState.currentTab === 'photos') {
                renderPhotoGrid();
            } else if (AppState.currentTab === 'inbox') {
                renderInboxLists();
            }
        });

        // Subscribe UI updates to Gemma AI service state changes
        AppState.gemmaService.subscribe((state) => {
            updateGemmaUI(state);
        });

        // Initialize sample demo inbox items so inbox & SMS screens are immediately usable
        seedDemoInboxData();
    }

    function updateGemmaUI(state) {
        const pillDot = document.getElementById('ai-status-dot');
        const pillLabel = document.getElementById('ai-status-label');
        const photosDot = document.getElementById('photos-ai-dot');
        const photosText = document.getElementById('photos-ai-text');
        const settingsStatus = document.getElementById('settings-gemma-status');
        const settingsDesc = document.getElementById('settings-gemma-desc');
        const modalBadge = document.getElementById('gemma-modal-status-badge');
        const modalDesc = document.getElementById('gemma-modal-status-desc');

        let dotClass = 'bg-slate-400';
        let labelText = 'Gemma AI: Offline';
        let descText = 'PaliGemma 3B Vision (Offline)';

        if (state.isReady) {
            dotClass = 'bg-emerald-500 animate-pulse';
            labelText = 'Gemma AI: Ready';
            descText = `Active: ${state.activeModel ? state.activeModel.name : 'PaliGemma'}`;
        } else if (state.isLoading) {
            dotClass = 'bg-amber-500 animate-pulse';
            labelText = 'Gemma: Loading...';
            descText = 'Model weights initializing...';
        } else if (state.isBackendReachable) {
            dotClass = 'bg-amber-500';
            labelText = 'Gemma: Standby';
            descText = 'Backend Reachable (Model Not Loaded)';
        } else if (state.isError) {
            dotClass = 'bg-red-500';
            labelText = 'Gemma: Error';
            descText = 'Inference error (Check diagnostics)';
        } else {
            dotClass = 'bg-slate-400';
            labelText = 'Gemma: Offline';
            descText = 'Local Hashing Active (Unconfigured)';
        }

        if (pillDot) pillDot.className = `w-2 h-2 rounded-full ${dotClass}`;
        if (pillLabel) pillLabel.innerText = labelText;
        if (photosDot) photosDot.className = `w-2 h-2 rounded-full ${dotClass}`;
        if (photosText) photosText.innerText = state.isReady ? `AI Status: ${state.activeModel.name} Active` : `AI Status: Offline (Exact SHA-256 Active)`;
        if (settingsStatus) settingsStatus.innerText = state.isReady ? 'Ready' : (state.isLoading ? 'Loading' : (state.isError ? 'Error' : 'Offline'));
        if (settingsDesc) settingsDesc.innerText = descText;
        if (modalBadge) {
            modalBadge.className = `px-2 py-0.5 rounded-full text-xs font-bold ${state.isReady ? 'bg-emerald-100 text-emerald-800' : (state.isError ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800')}`;
            modalBadge.innerText = state.status.toUpperCase();
        }
        if (modalDesc) modalDesc.innerText = state.message || '';
    }

    /**
     * Pre-populate demo inbox & SMS items with clear "Demo Data" tags
     */
    function seedDemoInboxData() {
        const demoItems = [
            {
                id: 'demo_email_1',
                category: 'email',
                displayName: 'Mega Store Daily Deals',
                details: '🔥 70% Off Ends Tonight! Don\'t miss out...',
                reason: '14 promotional emails received this month',
                sizeBytes: 2.4 * 1024 * 1024,
                keepSafe: false,
                selected: true,
                isDemo: true
            },
            {
                id: 'demo_email_2',
                category: 'email',
                displayName: 'Weekly Tech Digest',
                details: 'Top 10 software tips and newsletter digests',
                reason: 'Unopened marketing newsletter for 6 months',
                sizeBytes: 1.1 * 1024 * 1024,
                keepSafe: false,
                selected: true,
                isDemo: true
            },
            {
                id: 'demo_email_3',
                category: 'email',
                displayName: 'Flight Booking Confirmation',
                details: 'Your e-ticket & receipt for flight #6E-204',
                reason: 'Important travel itinerary & payment document',
                sizeBytes: 450 * 1024,
                keepSafe: true, // Default protected!
                selected: false,
                isDemo: true
            },
            {
                id: 'demo_sms_1',
                category: 'sms',
                displayName: 'OTP Verification Code #89201',
                details: 'Your single-use sign-in code',
                reason: 'Expired 14 days ago',
                sizeBytes: 2 * 1024,
                keepSafe: false,
                selected: true,
                isDemo: true
            },
            {
                id: 'demo_sms_2',
                category: 'sms',
                displayName: 'Flash Sale Promo SMS',
                details: 'Get 50% cashback on your next ride',
                reason: 'Promotional marketing broadcast message',
                sizeBytes: 4 * 1024,
                keepSafe: false,
                selected: true,
                isDemo: true
            }
        ];

        AppState.reviewStore.addItems(demoItems);
    }

    // -------------------------------------------------------------------------
    // Mascot State Manager
    // -------------------------------------------------------------------------
    function setSlothState(state) {
        const svgEl = document.getElementById('sloth-svg-container');
        const eyesOpen = document.getElementById('eyes-open');
        const eyesClosed = document.getElementById('eyes-closed');
        const broom = document.getElementById('magical-broom');
        const sleepParticles = document.getElementById('sleep-particles');
        const cleanParticles = document.getElementById('clean-particles');

        if (!svgEl || !broom) return;

        // Reset base classes and particles
        svgEl.className = "relative z-10 w-44 h-44 cursor-pointer transition-transform duration-300";
        broom.setAttribute('class', 'transition-transform duration-500');
        broom.style.transform = "";

        if (sleepParticles) sleepParticles.classList.add('hidden');
        if (cleanParticles) cleanParticles.classList.add('hidden');
        if (eyesOpen) eyesOpen.classList.remove('hidden');
        if (eyesClosed) eyesClosed.classList.add('hidden');

        // Apply state
        switch (state) {
            case 'PEEK':
                if (!AppState.reducedMotion) svgEl.classList.add('anim-float');
                break;
            case 'NAP':
                if (eyesOpen) eyesOpen.classList.add('hidden');
                if (eyesClosed) eyesClosed.classList.remove('hidden');
                if (sleepParticles && !AppState.reducedMotion) sleepParticles.classList.remove('hidden');
                broom.style.transform = "rotate(-25deg) translate(-10px, 15px)";
                if (!AppState.reducedMotion) svgEl.classList.add('anim-breathe');
                break;
            case 'WAKE':
                if (!AppState.reducedMotion) {
                    svgEl.classList.add('anim-hop');
                    setTimeout(() => svgEl.classList.remove('anim-hop'), 700);
                }
                break;
            case 'CLEAN':
                if (!AppState.reducedMotion) {
                    broom.classList.add('anim-sweep');
                    if (cleanParticles) cleanParticles.classList.remove('hidden');
                }
                break;
            case 'CELEBRATE':
                if (!AppState.reducedMotion) {
                    svgEl.classList.add('anim-hop');
                    if (cleanParticles) cleanParticles.classList.remove('hidden');
                }
                break;
        }
    }

    function updateSlothForTab(tabId) {
        const speechEl = document.getElementById('sloth-speech');
        let speech = SlothSpeeches[tabId] || SlothSpeeches.home;

        if (tabId === 'inbox') {
            speech = AppState.inboxSubTab === 'email' ? SlothSpeeches.inboxEmail : SlothSpeeches.inboxSms;
        }

        if (speechEl) speechEl.innerText = speech;

        if (tabId === 'home') {
            setSlothState('NAP');
        } else if (tabId === 'photos' || tabId === 'inbox') {
            setSlothState('WAKE');
        } else if (tabId === 'review' || tabId === 'settings') {
            setSlothState('PEEK');
        }
    }

    function triggerSlothInteraction() {
        if (AppState.isScanning) return;
        const speechEl = document.getElementById('sloth-speech');
        setSlothState('WAKE');
        if (speechEl) {
            speechEl.innerText = "Yawn... I'm awake! Ready to sweep whenever you are!";
        }
        setTimeout(() => {
            if (AppState.currentTab === 'home') {
                setSlothState('NAP');
                if (speechEl) speechEl.innerText = SlothSpeeches.home;
            } else {
                setSlothState('PEEK');
            }
        }, 3200);
    }

    // -------------------------------------------------------------------------
    // Tab Navigation
    // -------------------------------------------------------------------------
    function switchTab(tabId, subTab = null) {
        if (AppState.isScanning) return;

        AppState.currentTab = tabId;

        // Hide all views
        ['home', 'photos', 'inbox', 'settings', 'review'].forEach(id => {
            const el = document.getElementById(`view-${id}`);
            if (el) el.classList.add('hidden');
        });

        // Show active view
        const activeView = document.getElementById(`view-${tabId}`);
        if (activeView) activeView.classList.remove('hidden');

        // Update bottom navigation bar styles
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('text-forest');
            btn.classList.add('text-mutedText');
        });
        const activeNav = document.getElementById(`nav-${tabId}`);
        if (activeNav) {
            activeNav.classList.remove('text-mutedText');
            activeNav.classList.add('text-forest');
        }

        // Subtab if provided
        if (tabId === 'inbox' && subTab) {
            toggleInboxSubTab(subTab);
        }

        // Update mascot pose and speech
        updateSlothForTab(tabId);

        // Specific view renders
        if (tabId === 'photos') {
            renderPhotoGrid();
        } else if (tabId === 'inbox') {
            renderInboxLists();
        }
    }

    function toggleInboxSubTab(type) {
        AppState.inboxSubTab = type;
        const btnEmail = document.getElementById('tab-btn-email');
        const btnSms = document.getElementById('tab-btn-sms');
        const panelEmail = document.getElementById('panel-email');
        const panelSms = document.getElementById('panel-sms');
        const speechEl = document.getElementById('sloth-speech');

        if (type === 'email') {
            if (btnEmail) btnEmail.className = "flex-1 py-2 rounded-xl text-xs font-bold text-forest bg-white shadow-sm transition";
            if (btnSms) btnSms.className = "flex-1 py-2 rounded-xl text-xs font-bold text-mutedText hover:text-forest transition";
            if (panelEmail) panelEmail.classList.remove('hidden');
            if (panelSms) panelSms.classList.add('hidden');
            if (speechEl) speechEl.innerText = SlothSpeeches.inboxEmail;
        } else {
            if (btnSms) btnSms.className = "flex-1 py-2 rounded-xl text-xs font-bold text-forest bg-white shadow-sm transition";
            if (btnEmail) btnEmail.className = "flex-1 py-2 rounded-xl text-xs font-bold text-mutedText hover:text-forest transition";
            if (panelSms) panelSms.classList.remove('hidden');
            if (panelEmail) panelEmail.classList.add('hidden');
            if (speechEl) speechEl.innerText = SlothSpeeches.inboxSms;
        }
    }

    // -------------------------------------------------------------------------
    // Global Summary Badges
    // -------------------------------------------------------------------------
    function updateGlobalBadges(summary) {
        // Home Storage Summary Card
        const homeStorageNumber = document.getElementById('home-cleanable-size');
        const homeStorageUnit = document.getElementById('home-cleanable-unit');
        const homeItemCount = document.getElementById('home-cleanable-count');

        if (homeStorageNumber && homeStorageUnit) {
            const formatted = summary.formattedSelectedBytes.split(' ');
            homeStorageNumber.innerText = formatted[0] || '0';
            homeStorageUnit.innerText = formatted[1] || 'B';
        }
        if (homeItemCount) {
            homeItemCount.innerText = `${summary.selectedCount} Items`;
        }

        // Review Tab Badges
        const reviewBadgeCount = document.getElementById('selected-count-badge');
        const reviewBadgeSize = document.getElementById('selected-size-badge');
        const navReviewDot = document.getElementById('nav-review-dot');

        if (reviewBadgeCount) reviewBadgeCount.innerText = `${summary.selectedCount} Items`;
        if (reviewBadgeSize) reviewBadgeSize.innerText = `${summary.formattedSelectedBytes} Total`;
        if (navReviewDot) {
            if (summary.selectedCount > 0) {
                navReviewDot.classList.remove('hidden');
            } else {
                navReviewDot.classList.add('hidden');
            }
        }

        // Confirmation Modal Badges
        const modalCount = document.getElementById('modal-item-count');
        const modalSize = document.getElementById('modal-item-size');
        if (modalCount) modalCount.innerText = `${summary.selectedCount} items`;
        if (modalSize) modalSize.innerText = summary.formattedSelectedBytes;
    }

    // -------------------------------------------------------------------------
    // Photos Workflow (Real Local Files & SHA-256 Duplicate Detection)
    // -------------------------------------------------------------------------
    function handlePhotoFileInput(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        const fileList = Array.from(files);
        const imageFiles = fileList.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name));

        if (imageFiles.length === 0) {
            const speechEl = document.getElementById('sloth-speech');
            if (speechEl) {
                speechEl.innerText = "Hmm, those don't look like image files! LazySloth Photo cleaner only accepts images (JPEG, PNG, WebP, etc.).";
            }
            alert("No supported images detected. Please select image files (e.g. JPG, PNG, WEBP).");
            event.target.value = '';
            return;
        }

        processLocalPhotoFiles(imageFiles, false);
        // Reset file input value so selecting the same files again triggers change
        event.target.value = '';
    }

    function initDragAndDrop() {
        const dropZone = document.getElementById('photo-drop-zone');
        if (!dropZone) return;

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('border-coral', 'bg-coralLight/30');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('border-coral', 'bg-coralLight/30');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt ? dt.files : null;
            if (!files || files.length === 0) return;

            const fileList = Array.from(files);
            const imageFiles = fileList.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(f.name));

            if (imageFiles.length === 0) {
                const speechEl = document.getElementById('sloth-speech');
                if (speechEl) {
                    speechEl.innerText = "Hmm, those don't look like image files! LazySloth Photo cleaner only accepts images (JPEG, PNG, WebP, etc.).";
                }
                alert("No supported images detected. Please drop image files (e.g. JPG, PNG, WEBP).");
                return;
            }

            processLocalPhotoFiles(imageFiles, false);
        }, false);
    }

    async function processLocalPhotoFiles(files, isSampleBatch = false) {
        if (AppState.isScanning) return;
        AppState.isScanning = true;

        const progressBox = document.getElementById('scan-progress-box');
        const progressFill = document.getElementById('scan-progress-fill');
        const progressPercent = document.getElementById('scan-percentage');
        const progressText = document.getElementById('scan-status-text');
        const speechEl = document.getElementById('sloth-speech');

        if (progressBox) progressBox.classList.remove('hidden');
        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.innerText = '0%';
        if (speechEl) speechEl.innerText = SlothSpeeches.scanning;
        setSlothState('CLEAN');

        try {
            const scanResult = await AppState.detector.scanFiles(files, (progress) => {
                if (progressFill) progressFill.style.width = `${progress.percent}%`;
                if (progressPercent) progressPercent.innerText = `${progress.percent}%`;
                if (progressText) {
                    progressText.innerHTML = `<i class="fa-solid fa-broom animate-spin text-coral mr-1"></i> Hashing ${progress.current}/${progress.total}: ${escapeHtml(progress.currentFileName)}`;
                }
            });

            // Create object URLs for thumbnails & run Gemma/heuristic classification
            for (const item of scanResult.items) {
                if (isSampleBatch || (item.file && item.file.isSample)) {
                    item.isSample = true;
                }

                if (item.file && !item.thumbnailUrl) {
                    try {
                        item.thumbnailUrl = URL.createObjectURL(item.file);
                    } catch (e) {
                        console.warn('Could not create thumbnail URL:', e);
                    }
                }

                try {
                    const aiResult = await AppState.gemmaService.classifyPhoto(item.file || { name: item.fileName, isDuplicate: item.isDuplicate });
                    item.aiClassification = aiResult;
                    // Invariant: If AI identifies a document or study note, ALWAYS enforce Keep Safe protection
                    if (aiResult.category === 'documents' || (aiResult.keepSafe && !item.isDuplicate)) {
                        item.keepSafe = true;
                        item.selected = false;
                    }
                } catch (aiErr) {
                    console.warn('[LazySloth] AI classification error:', aiErr);
                }
            }

            // Add processed items into centralized ReviewStore
            AppState.reviewStore.addItems(scanResult.items);

            // Finish scan feedback
            setSlothState('CELEBRATE');
            const dupCount = scanResult.stats.duplicateCount;
            if (speechEl) {
                if (dupCount > 0) {
                    speechEl.innerText = `Swept through! Found ${dupCount} exact duplicate${dupCount > 1 ? 's' : ''} (${scanResult.stats.formattedDuplicateBytes}). Your notes were kept safe!`;
                } else {
                    speechEl.innerText = `All ${scanResult.stats.totalFiles} images are unique! No exact byte duplicates found.`;
                }
            }

            renderPhotoGrid();

        } catch (err) {
            console.error('[LazySloth] Scanning failed:', err);
            if (speechEl) speechEl.innerText = `Oops! Scanning stopped: ${err.message}`;
            alert(`Photo scanning error: ${err.message}`);
        } finally {
            setTimeout(() => {
                if (progressBox) progressBox.classList.add('hidden');
                AppState.isScanning = false;
            }, 800);
        }
    }

    function filterPhotos(category) {
        AppState.photoFilter = category;
        document.querySelectorAll('.photo-filter-btn').forEach(btn => {
            btn.classList.remove('bg-forest', 'text-white');
            btn.classList.add('bg-white', 'text-mutedText');
        });
        const activeBtn = document.getElementById(`photo-filter-${category}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-mutedText');
            activeBtn.classList.add('bg-forest', 'text-white');
        }
        renderPhotoGrid();
    }

    function renderPhotoGrid() {
        const grid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('photo-empty-state');
        const summaryWidget = document.getElementById('photo-summary-widget');
        if (!grid) return;

        const allPhotoItems = AppState.reviewStore.getByCategory('photo');

        // Update pill counts
        const dupCount = allPhotoItems.filter(p => p.isDuplicate).length;
        const safeCount = allPhotoItems.filter(p => p.keepSafe).length;
        const uniqueCount = allPhotoItems.filter(p => !p.isDuplicate && !p.keepSafe).length;

        const countAll = document.getElementById('photo-count-all');
        const countDup = document.getElementById('photo-count-dup');
        const countSafe = document.getElementById('photo-count-safe');
        const countUnique = document.getElementById('photo-count-unique');

        if (countAll) countAll.innerText = `(${allPhotoItems.length})`;
        if (countDup) countDup.innerText = `(${dupCount})`;
        if (countSafe) countSafe.innerText = `(${safeCount})`;
        if (countUnique) countUnique.innerText = `(${uniqueCount})`;

        // Update batch scan summary widget
        if (summaryWidget) {
            if (allPhotoItems.length > 0) {
                summaryWidget.classList.remove('hidden');
                const totalEl = document.getElementById('summary-total-files');
                const dupEl = document.getElementById('summary-dup-count');
                const safeEl = document.getElementById('summary-safe-count');
                const cleanableEl = document.getElementById('summary-cleanable-bytes');

                const cleanableBytes = allPhotoItems
                    .filter(p => p.selected && !p.keepSafe)
                    .reduce((acc, p) => acc + (p.fileSize || 0), 0);

                if (totalEl) totalEl.innerText = `${allPhotoItems.length} Photo${allPhotoItems.length === 1 ? '' : 's'}`;
                if (dupEl) dupEl.innerText = dupCount;
                if (safeEl) safeEl.innerText = safeCount;
                if (cleanableEl) cleanableEl.innerText = AppState.detector.formatBytes(cleanableBytes);
            } else {
                summaryWidget.classList.add('hidden');
            }
        }

        // Filter items
        let filtered = allPhotoItems;
        if (AppState.photoFilter === 'dup') {
            filtered = allPhotoItems.filter(p => p.isDuplicate);
        } else if (AppState.photoFilter === 'safe') {
            filtered = allPhotoItems.filter(p => p.keepSafe);
        } else if (AppState.photoFilter === 'unique') {
            filtered = allPhotoItems.filter(p => !p.isDuplicate && !p.keepSafe);
        }

        if (allPhotoItems.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        grid.innerHTML = '';

        filtered.forEach(item => {
            const card = document.createElement('div');
            card.className = "paper-card rounded-2xl overflow-hidden border border-sage/20 relative flex flex-col justify-between";

            const tagColor = item.keepSafe 
                ? 'bg-emerald-600 text-white' 
                : (item.isDuplicate ? 'bg-coral text-white' : 'bg-white/90 text-forest');
            const tagIcon = item.keepSafe 
                ? '<i class="fa-solid fa-shield mr-1"></i>Keep Safe' 
                : (item.isDuplicate ? '<i class="fa-solid fa-copy mr-1"></i>Exact Match' : 'Unique');

            const sourceBadge = item.isSample
                ? '<span class="text-[8px] font-bold bg-amber-50 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">Demo Sample</span>'
                : '<span class="text-[8px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">Local File</span>';

            const thumbSrc = item.thumbnailUrl || 'https://placehold.co/150x120/A8C8A0/244C3A?text=Image';

            card.innerHTML = `
                <div class="relative h-28 w-full bg-slate-100 group">
                    <img src="${thumbSrc}" alt="${escapeHtml(item.displayName)}" class="w-full h-full object-cover">
                    <span class="absolute top-2 left-2 text-[9px] font-bold ${tagColor} px-2 py-0.5 rounded-full shadow-sm">
                        ${tagIcon}
                    </span>
                    <button onclick="LazySlothApp.removePhotoItem('${item.id}')" title="Remove from session" class="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-white/90 hover:bg-red-50 text-red-600 flex items-center justify-center text-[10px] shadow-sm transition">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <input type="checkbox" 
                           ${item.selected ? 'checked' : ''} 
                           ${item.keepSafe ? 'disabled title="Protected with Keep Safe"' : ''}
                           onchange="LazySlothApp.toggleItemSelect('${item.id}', this.checked)" 
                           class="item-checkbox absolute top-2 right-2 w-4 h-4 rounded text-coral focus:ring-coral cursor-pointer ${item.keepSafe ? 'opacity-40 cursor-not-allowed' : ''}">
                </div>
                <div class="p-2.5 bg-white space-y-1">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-1 min-w-0 mr-1">
                            <h4 class="font-bold text-xs text-forest truncate" title="${escapeHtml(item.displayName)}">${escapeHtml(item.displayName)}</h4>
                            ${sourceBadge}
                        </div>
                        <span class="text-[10px] font-bold text-mutedText flex-shrink-0">${item.formattedSize}</span>
                    </div>
                    <p class="text-[9px] text-mutedText truncate" title="${escapeHtml(item.reason)}">${escapeHtml(item.reason)}</p>
                    ${item.aiClassification ? `
                    <div class="pt-0.5 pb-0.5">
                        ${item.aiClassification.method === 'gemma-vision-model' 
                            ? `<span class="inline-flex items-center space-x-1 bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.2 rounded text-[8px] font-bold" title="${escapeHtml(item.aiClassification.explanation)}">
                                 <i class="fa-solid fa-brain text-[8px] text-purple-700"></i>
                                 <span>Gemma: ${escapeHtml(item.aiClassification.category)} (${Math.round(item.aiClassification.confidence * 100)}%)</span>
                               </span>`
                            : `<span class="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded text-[8px] font-medium" title="${escapeHtml(item.aiClassification.explanation)}">
                                 <i class="fa-solid fa-code-branch text-[8px] text-slate-500"></i>
                                 <span>Rule: ${escapeHtml(item.aiClassification.category)}</span>
                               </span>`
                        }
                    </div>` : ''}
                    <div class="pt-1 flex items-center justify-between border-t border-sage/10 text-[10px]">
                        <button onclick="LazySlothApp.toggleItemKeepSafe('${item.id}')" class="font-bold ${item.keepSafe ? 'text-emerald-700 hover:text-emerald-800' : 'text-forest hover:text-coral'} flex items-center space-x-1">
                            <i class="fa-solid ${item.keepSafe ? 'fa-lock' : 'fa-lock-open'}"></i>
                            <span>${item.keepSafe ? 'Protected' : 'Protect'}</span>
                        </button>
                        ${item.hash ? `<span class="font-mono text-[8px] text-mutedText" title="SHA-256: ${item.hash}">#${item.hash.substring(0, 6)}</span>` : ''}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function removePhotoItem(id) {
        AppState.reviewStore.removeItem(id);
    }

    function toggleItemSelect(id, checked) {
        AppState.reviewStore.toggleSelect(id, checked);
    }

    function toggleItemKeepSafe(id) {
        AppState.reviewStore.toggleKeepSafe(id);
    }

    /**
     * Helper to load built-in sample photos to test the duplicate detection workflow
     * without needing the user to upload their own images
     */
    async function loadSamplePhotos() {
        // Create synthetic blobs with matching and distinct byte contents
        const sample1Text = "LAZY_SLOTH_SAMPLE_IMAGE_BYTE_STREAM_A";
        const sample2Text = "LAZY_SLOTH_SAMPLE_IMAGE_BYTE_STREAM_A"; // Exact match with 1!
        const sample3Text = "LAZY_SLOTH_SAMPLE_IMAGE_BYTE_STREAM_B"; // Distinct!
        const sampleDocText = "STUDY_NOTES_MATH_WHITEBOARD_LECTURE_2026"; // Document keyword!

        const file1 = new File([sample1Text], "sunset_vacation_01.jpg", { type: "image/jpeg" });
        const file2 = new File([sample2Text], "sunset_vacation_copy.jpg", { type: "image/jpeg" });
        const file3 = new File([sample3Text], "forest_cabin_view.jpg", { type: "image/jpeg" });
        const file4 = new File([sampleDocText], "study_notes_calculus_lecture.jpg", { type: "image/jpeg" });

        [file1, file2, file3, file4].forEach(f => { f.isSample = true; });

        await processLocalPhotoFiles([file1, file2, file3, file4], true);
    }

    // -------------------------------------------------------------------------
    // Inbox & Messages View Renderers
    // -------------------------------------------------------------------------
    function renderInboxLists() {
        const emailContainer = document.getElementById('email-items-container');
        const smsContainer = document.getElementById('sms-items-container');

        if (emailContainer) {
            const emails = AppState.reviewStore.getByCategory('email');
            emailContainer.innerHTML = '';
            emails.forEach(item => {
                const card = document.createElement('div');
                card.className = "paper-card rounded-2xl p-3.5 flex items-start justify-between border border-sage/20";
                card.innerHTML = `
                    <div class="flex items-start space-x-3 flex-1 mr-2">
                        <input type="checkbox" 
                               ${item.selected ? 'checked' : ''} 
                               ${item.keepSafe ? 'disabled title="Protected with Keep Safe"' : ''}
                               onchange="LazySlothApp.toggleItemSelect('${item.id}', this.checked)" 
                               class="item-checkbox mt-1 w-4 h-4 rounded text-coral focus:ring-coral ${item.keepSafe ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
                        <div class="space-y-0.5 flex-1">
                            <div class="flex items-center space-x-1.5 flex-wrap">
                                <h4 class="font-bold text-xs text-forest">${escapeHtml(item.displayName)}</h4>
                                <span class="text-[9px] ${item.keepSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} px-1.5 py-0.2 rounded font-semibold">
                                    ${item.keepSafe ? 'Keep Safe' : (item.isDemo ? 'Sample Demo' : 'Promo')}
                                </span>
                            </div>
                            <p class="text-[11px] font-medium text-darkText">${escapeHtml(item.details || '')}</p>
                            <p class="text-[10px] text-mutedText">${escapeHtml(item.reason)}</p>
                        </div>
                    </div>
                    <div class="text-right flex flex-col items-end space-y-1">
                        <span class="text-[10px] font-bold text-mutedText">${item.formattedSize}</span>
                        <button onclick="LazySlothApp.toggleItemKeepSafe('${item.id}')" class="text-[9px] font-bold ${item.keepSafe ? 'text-emerald-700' : 'text-mutedText hover:text-forest'}">
                            ${item.keepSafe ? '<i class="fa-solid fa-lock"></i> Safe' : 'Protect'}
                        </button>
                    </div>
                `;
                emailContainer.appendChild(card);
            });
        }

        if (smsContainer) {
            const smsList = AppState.reviewStore.getByCategory('sms');
            smsContainer.innerHTML = '';
            smsList.forEach(item => {
                const card = document.createElement('div');
                card.className = "paper-card rounded-2xl p-3.5 flex items-start justify-between border border-sage/20";
                card.innerHTML = `
                    <div class="flex items-start space-x-3 flex-1 mr-2">
                        <input type="checkbox" 
                               ${item.selected ? 'checked' : ''} 
                               ${item.keepSafe ? 'disabled title="Protected with Keep Safe"' : ''}
                               onchange="LazySlothApp.toggleItemSelect('${item.id}', this.checked)" 
                               class="item-checkbox mt-1 w-4 h-4 rounded text-coral focus:ring-coral ${item.keepSafe ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}">
                        <div class="space-y-0.5 flex-1">
                            <div class="flex items-center space-x-1.5">
                                <h4 class="font-bold text-xs text-forest">${escapeHtml(item.displayName)}</h4>
                                <span class="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">Demo SMS</span>
                            </div>
                            <p class="text-[11px] text-darkText">${escapeHtml(item.details || '')}</p>
                            <p class="text-[10px] text-mutedText">${escapeHtml(item.reason)}</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold font-mono text-coral bg-coralLight px-2 py-0.5 rounded">EXPIRED</span>
                `;
                smsContainer.appendChild(card);
            });
        }
    }

    // -------------------------------------------------------------------------
    // Review Tab View Renderer
    // -------------------------------------------------------------------------
    function renderReviewView(items, summary) {
        const listContainer = document.getElementById('review-items-list');
        const emptyState = document.getElementById('review-empty-state');
        const sweepBtn = document.getElementById('btn-sweep-review');

        if (!listContainer) return;

        const selectedItems = items.filter(item => item.selected && !item.keepSafe);

        if (selectedItems.length === 0) {
            listContainer.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            if (sweepBtn) {
                sweepBtn.disabled = true;
                sweepBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');
        if (sweepBtn) {
            sweepBtn.disabled = false;
            sweepBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        listContainer.innerHTML = '';

        selectedItems.forEach(item => {
            const card = document.createElement('div');
            card.className = "paper-card rounded-2xl p-3 flex items-center justify-between border border-sage/20";

            let iconHtml = '<i class="fa-solid fa-file text-forest text-base"></i>';
            if (item.category === 'photo') {
                iconHtml = item.thumbnailUrl 
                    ? `<img src="${item.thumbnailUrl}" class="w-8 h-8 rounded-lg object-cover">` 
                    : '<i class="fa-solid fa-images text-coral text-base"></i>';
            } else if (item.category === 'email') {
                iconHtml = '<i class="fa-solid fa-envelope-open-text text-amber-600 text-base"></i>';
            } else if (item.category === 'sms') {
                iconHtml = '<i class="fa-solid fa-comment-dots text-emerald-600 text-base"></i>';
            }

            card.innerHTML = `
                <div class="flex items-center space-x-3 flex-1 min-w-0 mr-2">
                    <div class="w-9 h-9 rounded-xl bg-sageLight/50 flex items-center justify-center flex-shrink-0">
                        ${iconHtml}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center space-x-1.5">
                            <h4 class="font-bold text-xs text-forest truncate">${escapeHtml(item.displayName)}</h4>
                            ${item.isDemo ? '<span class="text-[8px] bg-slate-100 text-slate-600 px-1 rounded">Demo</span>' : ''}
                        </div>
                        <p class="text-[10px] text-mutedText truncate">${escapeHtml(item.reason)}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                    <span class="text-xs font-bold text-forest">${item.formattedSize}</span>
                    <button onclick="LazySlothApp.toggleItemSelect('${item.id}', false)" title="Deselect from cleanup" class="w-6 h-6 rounded-full hover:bg-slate-100 text-mutedText hover:text-forest flex items-center justify-center text-xs transition">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            listContainer.appendChild(card);
        });
    }

    // -------------------------------------------------------------------------
    // Safe Confirmation Modal
    // -------------------------------------------------------------------------
    function openDeleteConfirmationModal() {
        const summary = AppState.reviewStore.getSummary();
        if (summary.selectedCount === 0) {
            alert('No items are currently selected for cleanup!');
            return;
        }
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeDeleteConfirmationModal() {
        const modal = document.getElementById('confirm-modal');
        if (modal) modal.classList.add('hidden');
    }

    function executeFinalSweep() {
        closeDeleteConfirmationModal();
        const removedItems = AppState.reviewStore.removeSelected();
        const removedCount = removedItems.length;

        setSlothState('CELEBRATE');
        const speechEl = document.getElementById('sloth-speech');
        if (speechEl) {
            speechEl.innerText = `Swept away! Removed ${removedCount} items from this review session. Original device files were kept safe!`;
        }

        setTimeout(() => {
            switchTab('home');
        }, 2200);
    }

    // -------------------------------------------------------------------------
    // Email Connection Transparency Modal
    // -------------------------------------------------------------------------
    function openEmailConnectModal() {
        const modal = document.getElementById('email-connect-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeEmailConnectModal() {
        const modal = document.getElementById('email-connect-modal');
        if (modal) modal.classList.add('hidden');
    }

    // -------------------------------------------------------------------------
    // Dev Challenge Story Modal Handlers
    // -------------------------------------------------------------------------
    function openStoryModal() {
        const modal = document.getElementById('story-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    function closeStoryModal() {
        const modal = document.getElementById('story-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // -------------------------------------------------------------------------
    // Gemma AI Setup & Diagnostics Modal Handlers
    // -------------------------------------------------------------------------
    function openGemmaDiagnosticsModal() {
        const modal = document.getElementById('gemma-diagnostics-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const state = AppState.gemmaService.getStatus();
            const input = document.getElementById('gemma-endpoint-input');
            if (input && state.endpointUrl !== undefined) {
                input.value = state.endpointUrl;
                if (!state.endpointUrl && window.location.protocol === 'https:') {
                    input.placeholder = 'https://your-backend.onrender.com';
                }
            }
            updateGemmaUI(state);
        }
    }

    function closeGemmaDiagnosticsModal() {
        const modal = document.getElementById('gemma-diagnostics-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function runGemmaDiagnostics() {
        const output = document.getElementById('gemma-diag-output');
        if (output) output.innerText = 'Testing browser WebGPU hardware acceleration...';
        const diag = await AppState.gemmaService.checkEnvironmentSupport();
        if (output) {
            output.innerText = JSON.stringify({
                webGPU_Available: diag.webGPU,
                webGPU_DeviceCreated: diag.webGPUDevice,
                adapter: diag.adapterInfo,
                limits: diag.limits,
                webAssemblySIMD: diag.webAssembly,
                recommendation: diag.recommendation
            }, null, 2);
        }
    }

    async function connectLocalGemmaEndpoint() {
        const input = document.getElementById('gemma-endpoint-input');
        const url = (input && input.value) ? input.value.trim() : 'http://localhost:5001';
        const result = await AppState.gemmaService.connectLocalEndpoint(url);
        if (!result.success) {
            alert(`Connection notice: ${result.error}`);
        } else {
            alert(`Connected successfully to ${result.model.name}!`);
            closeGemmaDiagnosticsModal();
        }
    }

    async function requestGemmaModelDownload() {
        const confirmed = confirm(
            "BANDWIDTH & MEMORY NOTICE:\n\n" +
            "Downloading the quantized PaliGemma 3B vision model requires approximately 1.8 GB to 3.2 GB of data and at least 3.5 GB of available RAM/VRAM.\n\n" +
            "Do you authorize this download for local on-device inference?"
        );
        if (!confirmed) return;

        try {
            await AppState.gemmaService.initOnDeviceWebGPU({ userConsent: true });
        } catch (err) {
            alert(`Setup notice: ${err.message}`);
        }
    }

    // -------------------------------------------------------------------------
    // Accessibility: Reduced Motion
    // -------------------------------------------------------------------------
    function initReducedMotion() {
        const savedPref = localStorage.getItem('lazysloth_reduced_motion');
        const systemPref = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        AppState.reducedMotion = savedPref !== null ? savedPref === 'true' : systemPref;

        applyReducedMotion(AppState.reducedMotion);

        const motionToggle = document.getElementById('motion-toggle');
        if (motionToggle) {
            motionToggle.checked = AppState.reducedMotion;
            motionToggle.addEventListener('change', (e) => {
                AppState.reducedMotion = e.target.checked;
                localStorage.setItem('lazysloth_reduced_motion', AppState.reducedMotion);
                applyReducedMotion(AppState.reducedMotion);
            });
        }
    }

    function applyReducedMotion(isReduced) {
        if (isReduced) {
            document.body.classList.add('reduced-motion');
            setSlothState('PEEK');
        } else {
            document.body.classList.remove('reduced-motion');
            setSlothState(AppState.currentTab === 'home' ? 'NAP' : 'PEEK');
        }
    }

    function resetDemoSession() {
        if (confirm('Reset review session and reload default sample items?')) {
            AppState.reviewStore.clear();
            seedDemoInboxData();
            renderPhotoGrid();
            renderInboxLists();
            const speechEl = document.getElementById('sloth-speech');
            if (speechEl) speechEl.innerText = "Session reset! Ready for a fresh start.";
        }
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // -------------------------------------------------------------------------
    // App Initialization on DOM Ready
    // -------------------------------------------------------------------------
    function initApp() {
        initServices();
        initReducedMotion();
        initDragAndDrop();

        // Bind file input change
        const fileInput = document.getElementById('photo-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', handlePhotoFileInput);
        }

        // Set initial mascot state
        updateSlothForTab('home');

        console.log('[LazySloth Cleaner] App initialized in honest Local Mode.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

    // Public API for HTML event bindings
    window.LazySlothApp = {
        switchTab,
        toggleInboxSubTab,
        triggerSlothInteraction,
        handlePhotoFileInput,
        processLocalPhotoFiles,
        loadSamplePhotos,
        filterPhotos,
        removePhotoItem,
        toggleItemSelect,
        toggleItemKeepSafe,
        openDeleteConfirmationModal,
        closeDeleteConfirmationModal,
        executeFinalSweep,
        openEmailConnectModal,
        closeEmailConnectModal,
        openStoryModal,
        closeStoryModal,
        openGemmaDiagnosticsModal,
        closeGemmaDiagnosticsModal,
        runGemmaDiagnostics,
        connectLocalGemmaEndpoint,
        requestGemmaModelDownload,
        resetDemoSession,
        getGemmaService: () => AppState.gemmaService
    };

})();
