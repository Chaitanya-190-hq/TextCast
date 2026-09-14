/**
 * TextCast — Admin Studio Logic
 * Handles .txt drag-and-drop, manual input, auto-ID calculation,
 * live preview, non-destructive publishing, and content.json generation.
 */

(function() {
  'use strict';

  const CONFIG = {
    contentUrl: 'data/content.json',
    storageKey: 'textcast_custom_posts',
    themeKey: 'textcast_theme',
    paletteKey: 'textcast_palette'
  };

  const PALETTE_COLORS = {
    indigo: '#4f46e5',
    emerald: '#10b981',
    rose: '#f43f5e',
    sepia: '#d97706',
    ocean: '#0284c7',
    cyber: '#a855f7'
  };

  const state = {
    posts: [],
    nextId: 'P001',
    activeTab: 'upload',
    theme: 'light',
    palette: 'indigo',
    mode: 'light'
  };

  // DOM Elements
  const dom = {
    // Clear Cache & Modal
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    clearCacheIcon: document.getElementById('clearCacheIcon'),
    adminClearCacheBtn: document.getElementById('adminClearCacheBtn'),
    clearCacheModal: document.getElementById('clearCacheModal'),
    cancelClearCacheBtn: document.getElementById('cancelClearCacheBtn'),
    confirmClearCacheBtn: document.getElementById('confirmClearCacheBtn'),

    // Theme & Popover
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeActiveDot: document.getElementById('themeActiveDot'),
    themePopover: document.getElementById('themePopover'),
    modeLightBtn: document.getElementById('modeLightBtn'),
    modeDarkBtn: document.getElementById('modeDarkBtn'),

    assignedIdBadge: document.getElementById('assignedIdBadge'),
    liveReadTimeBadge: document.getElementById('liveReadTimeBadge'),
    liveWordCountBadge: document.getElementById('liveWordCountBadge'),

    tabUploadBtn: document.getElementById('tabUploadBtn'),
    tabPasteBtn: document.getElementById('tabPasteBtn'),
    uploadView: document.getElementById('uploadView'),

    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    uploadFileStatus: document.getElementById('uploadFileStatus'),
    uploadedFileName: document.getElementById('uploadedFileName'),
    removeFileBtn: document.getElementById('removeFileBtn'),

    titleInput: document.getElementById('titleInput'),
    descriptionInput: document.getElementById('descriptionInput'),
    contentInput: document.getElementById('contentInput'),

    publishBtn: document.getElementById('publishBtn'),
    previewToggleBtn: document.getElementById('previewToggleBtn'),
    downloadJsonBtn: document.getElementById('downloadJsonBtn'),
    clearFormBtn: document.getElementById('clearFormBtn'),

    adminPreviewBox: document.getElementById('adminPreviewBox'),
    previewCardContainer: document.getElementById('previewCardContainer'),

    archiveTotalCount: document.getElementById('archiveTotalCount'),
    cardsListContainer: document.getElementById('cardsListContainer'),

    toastContainer: document.getElementById('toastContainer')
  };

  // =========================================================================
  // Initialization
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    setupDropzone();
    loadExistingPosts();
  });

  // =========================================================================
  // Data & ID Calculation
  // =========================================================================
  async function loadExistingPosts() {
    let basePosts = [];

    try {
      const response = await fetch(CONFIG.contentUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.posts)) {
          basePosts = data.posts;
        }
      }
    } catch (err) {
      console.warn('Admin: Could not fetch data/content.json:', err);
    }

    const localPostsJson = localStorage.getItem(CONFIG.storageKey);
    let localPosts = [];
    if (localPostsJson) {
      try {
        localPosts = JSON.parse(localPostsJson);
      } catch (e) {
        console.error('Admin: Error parsing local posts:', e);
      }
    }

    // Merge without duplicating
    const postMap = new Map();
    basePosts.forEach(p => postMap.set(p.id, p));
    localPosts.forEach(p => postMap.set(p.id, p));

    state.posts = Array.from(postMap.values());

    computeNextId();
    renderExistingPostsList();
    updateLiveStats();
  }

  function computeNextId() {
    let maxNum = 0;

    state.posts.forEach(p => {
      if (p.id) {
        const match = p.id.match(/^P(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    state.nextId = `P${String(nextNum).padStart(3, '0')}`;
    dom.assignedIdBadge.textContent = `Target ID: ${state.nextId}`;
  }

  function updateLiveStats() {
    const text = dom.contentInput.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(words / 200));

    dom.liveWordCountBadge.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    dom.liveReadTimeBadge.textContent = `${minutes} min read`;

    updateCardPreview();
  }

  // =========================================================================
  // Dropzone & File Handling
  // =========================================================================
  function setupDropzone() {
    dom.dropzone.addEventListener('click', () => dom.fileInput.click());

    dom.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.dropzone.classList.add('dragover');
    });

    dom.dropzone.addEventListener('dragleave', () => {
      dom.dropzone.classList.remove('dragover');
    });

    dom.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dom.dropzone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });

    dom.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    dom.removeFileBtn.addEventListener('click', () => {
      dom.fileInput.value = '';
      dom.uploadFileStatus.style.display = 'none';
      dom.dropzone.style.display = 'flex';
      showToast('File unselected.', 'info');
    });
  }

  function handleFile(file) {
    if (!file.name.endsWith('.txt') && file.type !== 'text/plain') {
      showToast('Please select a valid .txt plain text file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      dom.contentInput.value = text;

      // Extract filename as default title if title is empty
      if (!dom.titleInput.value.trim()) {
        const cleanName = file.name
          .replace(/\.txt$/i, '')
          .replace(/[_-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        dom.titleInput.value = cleanName;
      }

      // Extract brief description if empty
      if (!dom.descriptionInput.value.trim()) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        if (lines.length > 0) {
          dom.descriptionInput.value = lines[0].slice(0, 120);
        }
      }

      dom.uploadedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
      dom.uploadFileStatus.style.display = 'flex';
      dom.dropzone.style.display = 'none';

      updateLiveStats();
      showToast(`Loaded "${file.name}"`, 'success');
    };

    reader.onerror = () => {
      showToast('Failed to read file.', 'error');
    };

    reader.readAsText(file);
  }

  // =========================================================================
  // Live Card Preview
  // =========================================================================
  function updateCardPreview() {
    const title = dom.titleInput.value.trim() || 'Untitled Note';
    const description = dom.descriptionInput.value.trim() || 'No description provided. Click to view full text in reader.';
    const text = dom.contentInput.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const readTime = `${Math.max(1, Math.ceil(words / 200))} min`;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    dom.previewCardContainer.innerHTML = `
      <article class="post-card" style="cursor: default; pointer-events: none; margin-bottom: 0;">
        <div class="card-top">
          <span class="badge badge-id">${escapeHtml(state.nextId)}</span>
          <span class="card-date">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${today}
          </span>
        </div>
        <h3 class="card-title">${escapeHtml(title)}</h3>
        <p class="card-description">${escapeHtml(description)}</p>
        <div class="card-bottom">
          <span class="read-time-pill">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ${escapeHtml(readTime)}
          </span>
          <span class="card-open-link">
            Read Card
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </span>
        </div>
      </article>
    `;
  }

  // =========================================================================
  // Publishing Action (Never overwrites!)
  // =========================================================================
  function publishCard() {
    const title = dom.titleInput.value.trim();
    const description = dom.descriptionInput.value.trim();
    const content = dom.contentInput.value.trim();

    if (!title) {
      showToast('Please enter a title for the card.', 'error');
      dom.titleInput.focus();
      return;
    }

    if (!content) {
      showToast('Please provide text content or upload a .txt file.', 'error');
      dom.contentInput.focus();
      return;
    }

    const words = content.split(/\s+/).length;
    const readTime = `${Math.max(1, Math.ceil(words / 200))} min`;
    const todayIso = new Date().toISOString().split('T')[0];

    const newPost = {
      id: state.nextId,
      title: title,
      description: description || content.slice(0, 120) + '...',
      content: content,
      createdAt: todayIso,
      readTime: readTime
    };

    // Add to state
    state.posts.push(newPost);

    // Save custom posts to localStorage
    const localPostsJson = localStorage.getItem(CONFIG.storageKey);
    let localPosts = [];
    if (localPostsJson) {
      try {
        localPosts = JSON.parse(localPostsJson);
      } catch (e) {}
    }

    // Append new post without overwriting previous
    localPosts.push(newPost);
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(localPosts));

    showToast(`Published card ${newPost.id}! Visible in archive.`, 'success');

    // Reset Form & update state
    clearForm(false);
    computeNextId();
    renderExistingPostsList();
  }

  // =========================================================================
  // Download Updated content.json
  // =========================================================================
  function downloadUpdatedJson() {
    const fullDatabase = {
      posts: state.posts
    };

    const jsonStr = JSON.stringify(fullDatabase, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Downloaded content.json (ready to commit to repo)', 'success');
  }

  // =========================================================================
  // Reset Form
  // =========================================================================
  function clearForm(showNotification = true) {
    dom.titleInput.value = '';
    dom.descriptionInput.value = '';
    dom.contentInput.value = '';
    dom.fileInput.value = '';
    dom.uploadFileStatus.style.display = 'none';
    dom.dropzone.style.display = 'flex';
    updateLiveStats();

    if (showNotification) {
      showToast('Form reset.', 'info');
    }
  }

  // =========================================================================
  // Existing Posts Manager List
  // =========================================================================
  function renderExistingPostsList() {
    dom.archiveTotalCount.textContent = state.posts.length;

    if (state.posts.length === 0) {
      dom.cardsListContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem; padding: 1rem 0;">No cards archived yet.</p>';
      return;
    }

    const sorted = [...state.posts].sort((a, b) => 
      (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id)
    );

    dom.cardsListContainer.innerHTML = sorted.map(post => {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden;">
            <span class="badge badge-id">${escapeHtml(post.id)}</span>
            <strong style="font-size: 0.92rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(post.title)}</strong>
            <span style="font-size: 0.78rem; color: var(--text-muted); white-space: nowrap;">${escapeHtml(post.createdAt || '')}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <span class="badge">${escapeHtml(post.readTime || '1 min')}</span>
            <a href="index.html#/post/${encodeURIComponent(post.id)}" class="btn btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.78rem;">
              View Card
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================
  function setupEventListeners() {
    // Tabs
    dom.tabUploadBtn.addEventListener('click', () => {
      dom.tabUploadBtn.classList.add('active');
      dom.tabPasteBtn.classList.remove('active');
      dom.uploadView.style.display = 'block';
    });

    dom.tabPasteBtn.addEventListener('click', () => {
      dom.tabPasteBtn.classList.add('active');
      dom.tabUploadBtn.classList.remove('active');
      dom.uploadView.style.display = 'none';
      dom.contentInput.focus();
    });

    // Inputs live stats
    dom.titleInput.addEventListener('input', updateCardPreview);
    dom.descriptionInput.addEventListener('input', updateCardPreview);
    dom.contentInput.addEventListener('input', updateLiveStats);

    // Actions
    dom.publishBtn.addEventListener('click', publishCard);
    dom.downloadJsonBtn.addEventListener('click', downloadUpdatedJson);
    dom.clearFormBtn.addEventListener('click', () => clearForm(true));

    // Clear Cache Modal events
    if (dom.clearCacheBtn) {
      dom.clearCacheBtn.addEventListener('click', openClearCacheModal);
    }
    if (dom.adminClearCacheBtn) {
      dom.adminClearCacheBtn.addEventListener('click', openClearCacheModal);
    }
    if (dom.cancelClearCacheBtn) {
      dom.cancelClearCacheBtn.addEventListener('click', closeClearCacheModal);
    }
    if (dom.confirmClearCacheBtn) {
      dom.confirmClearCacheBtn.addEventListener('click', handleClearCache);
    }
    if (dom.clearCacheModal) {
      dom.clearCacheModal.addEventListener('click', (e) => {
        if (e.target === dom.clearCacheModal) {
          closeClearCacheModal();
        }
      });
    }

    // Preview Toggle
    dom.previewToggleBtn.addEventListener('click', () => {
      const isVisible = dom.adminPreviewBox.style.display === 'block';
      dom.adminPreviewBox.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        dom.adminPreviewBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    // Theme Popover Menu Events
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dom.themePopover) {
          dom.themePopover.classList.toggle('open');
        }
      });
    }

    // Close Theme Popover on outside click
    document.addEventListener('click', (e) => {
      if (dom.themePopover && dom.themePopover.classList.contains('open')) {
        if (!dom.themePopover.contains(e.target) && !dom.themeToggle.contains(e.target)) {
          dom.themePopover.classList.remove('open');
        }
      }
    });

    // Mode Toggle Buttons
    if (dom.modeLightBtn) {
      dom.modeLightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTheme(state.palette, 'light');
      });
    }
    if (dom.modeDarkBtn) {
      dom.modeDarkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTheme(state.palette, 'dark');
      });
    }

    // Palette Options List
    if (dom.themePopover) {
      const paletteBtns = dom.themePopover.querySelectorAll('.palette-option-btn');
      paletteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosenPalette = btn.getAttribute('data-palette');
          if (chosenPalette) {
            setTheme(chosenPalette, state.mode);
          }
        });
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.clearCacheModal && dom.clearCacheModal.classList.contains('open')) {
          closeClearCacheModal();
          return;
        }
        if (dom.themePopover && dom.themePopover.classList.contains('open')) {
          dom.themePopover.classList.remove('open');
        }
      }
    });
  }

  // =========================================================================
  // Clear Cache Functionality
  // =========================================================================
  function openClearCacheModal() {
    if (dom.clearCacheModal) {
      dom.clearCacheModal.classList.add('open');
    }
  }

  function closeClearCacheModal() {
    if (dom.clearCacheModal) {
      dom.clearCacheModal.classList.remove('open');
    }
  }

  async function handleClearCache() {
    if (dom.clearCacheIcon) {
      dom.clearCacheIcon.classList.add('spinning');
    }

    try {
      // 1. Remove custom posts
      localStorage.removeItem(CONFIG.storageKey);

      // 2. Clear sessionStorage
      sessionStorage.clear();

      // 3. Clear CacheStorage
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        } catch (e) {
          console.warn('CacheStorage cleanup:', e);
        }
      }

      // 4. Reload existing posts from fresh content.json
      let basePosts = [];
      const freshUrl = `${CONFIG.contentUrl}?_t=${Date.now()}`;
      const response = await fetch(freshUrl, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.posts)) {
          basePosts = data.posts;
        }
      }

      state.posts = basePosts;
      computeNextId();
      renderExistingPostsList();
      updateLiveStats();

      showToast('Cache cleared! Local drafts reset and vault synchronized.', 'success');
    } catch (err) {
      console.error('Error clearing cache:', err);
      showToast('Failed to refresh data from server.', 'error');
    } finally {
      if (dom.clearCacheIcon) {
        dom.clearCacheIcon.classList.remove('spinning');
      }
      closeClearCacheModal();
    }
  }

  // =========================================================================
  // Theme Management
  // =========================================================================
  function initTheme() {
    let savedPalette = localStorage.getItem(CONFIG.paletteKey) || 'indigo';
    let savedMode = localStorage.getItem(CONFIG.themeKey);

    if (savedMode && savedMode.includes('-')) {
      const parts = savedMode.split('-');
      savedPalette = parts[0] || 'indigo';
      savedMode = parts[1] || 'light';
    } else if (!savedMode) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      savedMode = prefersDark ? 'dark' : 'light';
    }

    if (!PALETTE_COLORS[savedPalette]) {
      savedPalette = 'indigo';
    }

    setTheme(savedPalette, savedMode);
  }

  function setTheme(palette, mode) {
    state.palette = palette;
    state.mode = mode;
    state.theme = mode;

    document.documentElement.setAttribute('data-palette', palette);
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('data-theme', `${palette}-${mode}`);

    localStorage.setItem(CONFIG.paletteKey, palette);
    localStorage.setItem(CONFIG.themeKey, mode);

    if (dom.themeActiveDot) {
      dom.themeActiveDot.style.background = PALETTE_COLORS[palette] || 'var(--accent)';
    }

    if (dom.modeLightBtn && dom.modeDarkBtn) {
      dom.modeLightBtn.classList.toggle('active', mode === 'light');
      dom.modeDarkBtn.classList.toggle('active', mode === 'dark');
    }

    if (dom.themePopover) {
      const paletteBtns = dom.themePopover.querySelectorAll('.palette-option-btn');
      paletteBtns.forEach(btn => {
        const p = btn.getAttribute('data-palette');
        btn.classList.toggle('active', p === palette);
      });
    }

    if (dom.themeIcon) {
      if (mode === 'dark') {
        dom.themeIcon.innerHTML = `
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
      } else {
        dom.themeIcon.innerHTML = `
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
      }
    }
  }

  // =========================================================================
  // Toast System
  // =========================================================================
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    dom.toastContainer.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
