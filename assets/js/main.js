/**
 * TextCast — Main Application Logic
 * Notion Gallery + Medium Reading View + Live Archive Filter & Search
 */

(function() {
  'use strict';

  // =========================================================================
  // Configuration & State
  // =========================================================================
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
    filteredPosts: [],
    currentPost: null,
    searchQuery: '',
    currentSort: 'newest',
    currentMonth: 'all',
    theme: 'light',
    palette: 'indigo',
    mode: 'light'
  };

  // =========================================================================
  // DOM References
  // =========================================================================
  const dom = {
    // Top progress
    progressBar: document.getElementById('progressBar'),

    // Views
    archiveView: document.getElementById('archiveView'),
    readingView: document.getElementById('readingView'),

    // Header, Clear Cache & Theme
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    clearCacheIcon: document.getElementById('clearCacheIcon'),
    clearCacheModal: document.getElementById('clearCacheModal'),
    cancelClearCacheBtn: document.getElementById('cancelClearCacheBtn'),
    confirmClearCacheBtn: document.getElementById('confirmClearCacheBtn'),

    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeActiveDot: document.getElementById('themeActiveDot'),
    themePopover: document.getElementById('themePopover'),
    modeLightBtn: document.getElementById('modeLightBtn'),
    modeDarkBtn: document.getElementById('modeDarkBtn'),
    logoBtn: document.getElementById('logoBtn'),

    // Stats
    vaultTotalBadge: document.getElementById('vaultTotalBadge'),
    statTotalUploads: document.getElementById('statTotalUploads'),
    statTotalReadTime: document.getElementById('statTotalReadTime'),

    // Search & Filter
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    sortSelect: document.getElementById('sortSelect'),
    monthSelect: document.getElementById('monthSelect'),
    resultsCount: document.getElementById('resultsCount'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),

    // Gallery
    spotlightSection: document.getElementById('spotlightSection'),
    spotlightContent: document.getElementById('spotlightContent'),
    cardsGrid: document.getElementById('cardsGrid'),
    emptyState: document.getElementById('emptyState'),

    // Reading View
    backToArchiveBtn: document.getElementById('backToArchiveBtn'),
    footerBackBtn: document.getElementById('footerBackBtn'),
    copyArticleBtn: document.getElementById('copyArticleBtn'),
    downloadArticleBtn: document.getElementById('downloadArticleBtn'),
    shareArticleBtn: document.getElementById('shareArticleBtn'),
    readingPostId: document.getElementById('readingPostId'),
    readingPostDate: document.getElementById('readingPostDate'),
    readingPostReadTime: document.getElementById('readingPostReadTime'),
    readingPostTitle: document.getElementById('readingPostTitle'),
    readingPostDescription: document.getElementById('readingPostDescription'),
    readingPostBody: document.getElementById('readingPostBody'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // =========================================================================
  // Initialization
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    setupReadingProgress();
    loadAllPosts();
  });

  // =========================================================================
  // Data Loading & Storage Sync
  // =========================================================================
  async function loadAllPosts() {
    let basePosts = [];

    try {
      const response = await fetch(CONFIG.contentUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.posts)) {
          basePosts = data.posts;
        } else if (data.title && data.content) {
          // Backward compatibility with previous single-content prototype
          basePosts = [{
            id: 'P001',
            title: data.title,
            description: data.content.slice(0, 90) + '...',
            content: data.content,
            createdAt: data.updated ? data.updated.split('T')[0] : '2026-09-14',
            readTime: '2 min'
          }];
        }
      }
    } catch (err) {
      console.warn('Could not fetch data/content.json (using fallback/local):', err);
    }

    // Merge with any custom posts published in localStorage (never overwrites!)
    const localPostsJson = localStorage.getItem(CONFIG.storageKey);
    let localPosts = [];
    if (localPostsJson) {
      try {
        localPosts = JSON.parse(localPostsJson);
      } catch (e) {
        console.error('Error parsing local posts:', e);
      }
    }

    // Merge unique posts by ID (local posts take precedence or are appended)
    const postMap = new Map();
    basePosts.forEach(p => postMap.set(p.id, p));
    localPosts.forEach(p => postMap.set(p.id, p));

    state.posts = Array.from(postMap.values());

    // Populate month filter choices
    populateMonthFilter();

    // Update global metrics
    updateMetrics();

    // Handle initial route
    handleRoute();
  }

  // =========================================================================
  // Routing (Hash-based for 100% GitHub Pages static reliability)
  // =========================================================================
  function handleRoute() {
    const hash = window.location.hash || '#/';
    const queryPost = new URLSearchParams(window.location.search).get('post');

    let postId = null;

    if (queryPost) {
      postId = queryPost;
    } else if (hash.startsWith('#/post/')) {
      postId = decodeURIComponent(hash.replace('#/post/', '').trim());
    } else if (hash.startsWith('#post/')) {
      postId = decodeURIComponent(hash.replace('#post/', '').trim());
    }

    if (postId) {
      const post = state.posts.find(p => p.id.toLowerCase() === postId.toLowerCase());
      if (post) {
        showReadingView(post);
        return;
      } else {
        showToast(`Post "${postId}" not found. Showing archive.`, 'info');
      }
    }

    showArchiveView();
  }

  function showArchiveView() {
    state.currentPost = null;
    dom.readingView.style.display = 'none';
    dom.archiveView.style.display = 'block';
    dom.progressBar.style.width = '0%';
    document.title = 'TextCast — Public Digital Archive';

    // Apply active filter/sort & render
    applyFiltersAndSort();
  }

  function showReadingView(post) {
    state.currentPost = post;
    dom.archiveView.style.display = 'none';
    dom.readingView.style.display = 'block';

    // Update Meta
    dom.readingPostId.textContent = post.id;
    dom.readingPostDate.textContent = formatDate(post.createdAt);
    dom.readingPostReadTime.textContent = post.readTime || calculateReadTime(post.content);
    dom.readingPostTitle.textContent = post.title;
    
    if (post.description) {
      dom.readingPostDescription.textContent = post.description;
      dom.readingPostDescription.style.display = 'block';
    } else {
      dom.readingPostDescription.style.display = 'none';
    }

    // Render markdown content
    dom.readingPostBody.innerHTML = renderMarkdown(post.content);

    // Update Document Title
    document.title = `${post.title} — TextCast`;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update Progress Bar immediately
    updateScrollProgress();
  }

  function navigateToPost(id) {
    window.location.hash = `#/post/${encodeURIComponent(id)}`;
  }

  function navigateToArchive() {
    window.location.hash = '#/';
  }

  // =========================================================================
  // Filtering, Searching & Sorting
  // =========================================================================
  function applyFiltersAndSort() {
    let result = [...state.posts];

    // Search query filter
    const query = state.searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(post => {
        const titleMatch = (post.title || '').toLowerCase().includes(query);
        const descMatch = (post.description || '').toLowerCase().includes(query);
        const idMatch = (post.id || '').toLowerCase().includes(query);
        return titleMatch || descMatch || idMatch;
      });
    }

    // Month filter
    if (state.currentMonth !== 'all') {
      result = result.filter(post => {
        if (!post.createdAt) return false;
        const postMonth = post.createdAt.substring(0, 7); // 'YYYY-MM'
        return postMonth === state.currentMonth;
      });
    }

    // Sorting
    if (state.currentSort === 'newest') {
      result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id));
    } else if (state.currentSort === 'oldest') {
      result.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
    } else if (state.currentSort === 'quickest') {
      result.sort((a, b) => parseMinutes(a.readTime) - parseMinutes(b.readTime));
    } else if (state.currentSort === 'longest') {
      result.sort((a, b) => parseMinutes(b.readTime) - parseMinutes(a.readTime));
    }

    state.filteredPosts = result;

    // Render Gallery and Spotlight
    renderSpotlight();
    renderGallery();
    updateResultsCount();
  }

  function parseMinutes(readTimeStr) {
    if (!readTimeStr) return 1;
    const match = readTimeStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  }

  function populateMonthFilter() {
    const months = new Set();
    state.posts.forEach(post => {
      if (post.createdAt && post.createdAt.length >= 7) {
        months.add(post.createdAt.substring(0, 7));
      }
    });

    const sortedMonths = Array.from(months).sort().reverse();
    dom.monthSelect.innerHTML = '<option value="all">All Months</option>';

    sortedMonths.forEach(m => {
      const [year, month] = m.split('-');
      const dateObj = new Date(year, parseInt(month, 10) - 1, 1);
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const option = document.createElement('option');
      option.value = m;
      option.textContent = label;
      dom.monthSelect.appendChild(option);
    });
  }

  function updateMetrics() {
    const totalCount = state.posts.length;
    let totalMinutes = 0;

    state.posts.forEach(p => {
      totalMinutes += parseMinutes(p.readTime || calculateReadTime(p.content));
    });

    dom.vaultTotalBadge.textContent = `${totalCount} ${totalCount === 1 ? 'Card' : 'Cards'} Available`;
    dom.statTotalUploads.textContent = `${totalCount} ${totalCount === 1 ? 'card' : 'cards'}`;
    dom.statTotalReadTime.textContent = `~${totalMinutes} min`;
  }

  function updateResultsCount() {
    const total = state.posts.length;
    const count = state.filteredPosts.length;

    if (state.searchQuery || state.currentMonth !== 'all') {
      dom.resultsCount.textContent = `Showing ${count} of ${total} cards`;
    } else {
      dom.resultsCount.textContent = `${total} cards in vault`;
    }
  }

  // =========================================================================
  // Rendering
  // =========================================================================
  function renderSpotlight() {
    // Only show spotlight if on default view and we have posts
    if (state.searchQuery || state.currentMonth !== 'all' || state.posts.length === 0) {
      dom.spotlightSection.style.display = 'none';
      return;
    }

    dom.spotlightSection.style.display = 'block';
    // Newest post
    const newestPost = [...state.posts].sort((a, b) => 
      (b.createdAt || '').localeCompare(a.createdAt || '') || b.id.localeCompare(a.id)
    )[0];

    if (!newestPost) {
      dom.spotlightSection.style.display = 'none';
      return;
    }

    dom.spotlightContent.innerHTML = `
      <div class="spotlight-card" onclick="location.hash='#/post/${encodeURIComponent(newestPost.id)}'">
        <div class="spotlight-info">
          <div class="card-meta-row" style="margin-bottom: 0.5rem;">
            <span class="badge badge-id">${escapeHtml(newestPost.id)}</span>
            <span class="badge">${formatDate(newestPost.createdAt)}</span>
            <span class="badge">${escapeHtml(newestPost.readTime || calculateReadTime(newestPost.content))}</span>
          </div>
          <h2 class="spotlight-title">${escapeHtml(newestPost.title)}</h2>
          <p class="spotlight-desc">${escapeHtml(newestPost.description || 'Click to view full archived text file.')}</p>
        </div>
        <div>
          <button class="btn btn-primary" style="pointer-events: none;">
            <span>Read Post</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderGallery() {
    const list = state.filteredPosts;

    if (list.length === 0) {
      dom.cardsGrid.style.display = 'none';
      dom.emptyState.style.display = 'block';
      return;
    }

    dom.cardsGrid.style.display = 'grid';
    dom.emptyState.style.display = 'none';

    const query = state.searchQuery.trim().toLowerCase();

    dom.cardsGrid.innerHTML = list.map(post => {
      const readTime = post.readTime || calculateReadTime(post.content);
      const highlightedTitle = highlightMatch(post.title, query);
      const highlightedDesc = highlightMatch(post.description || 'No description provided.', query);

      return `
        <article class="post-card fade-in" data-id="${escapeHtml(post.id)}" onclick="location.hash='#/post/${encodeURIComponent(post.id)}'">
          <div class="card-top">
            <span class="badge badge-id">${escapeHtml(post.id)}</span>
            <span class="card-date">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              ${formatDate(post.createdAt)}
            </span>
          </div>

          <h3 class="card-title">${highlightedTitle}</h3>
          <p class="card-description">${highlightedDesc}</p>

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
    }).join('');
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);

    const safeText = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  // =========================================================================
  // Reading Actions (Copy, Download, Share)
  // =========================================================================
  function copyArticle() {
    if (!state.currentPost) return;
    const post = state.currentPost;
    const textToCopy = `${post.title}\nID: ${post.id}\nDate: ${post.createdAt}\n\n${post.content}`;

    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast('Full content copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy content.', 'error'));
  }

  function downloadArticle() {
    if (!state.currentPost) return;
    const post = state.currentPost;
    const header = `========================================\n${post.title}\nID: ${post.id} | Date: ${post.createdAt}\n========================================\n\n`;
    const fullText = header + post.content;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = (post.title || 'textcast-note').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${sanitizedTitle}_${post.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${post.id}.txt`, 'success');
  }

  function shareArticle() {
    if (!state.currentPost) return;
    const post = state.currentPost;
    const shareUrl = `${window.location.origin}${window.location.pathname}#/post/${encodeURIComponent(post.id)}`;

    if (navigator.share) {
      navigator.share({
        title: `${post.title} — TextCast`,
        text: post.description || post.title,
        url: shareUrl
      }).catch(err => {
        if (err.name !== 'AbortError') {
          copyShareLink(shareUrl);
        }
      });
    } else {
      copyShareLink(shareUrl);
    }
  }

  function copyShareLink(url) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => showToast('Could not copy link.', 'error'));
  }

  // =========================================================================
  // Reading Progress Bar
  // =========================================================================
  function setupReadingProgress() {
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
  }

  function updateScrollProgress() {
    if (dom.readingView.style.display === 'none') {
      dom.progressBar.style.width = '0%';
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

    if (docHeight <= 0) {
      dom.progressBar.style.width = '100%';
      return;
    }

    const progress = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
    dom.progressBar.style.width = `${progress}%`;
  }

  // =========================================================================
  // Theme Management
  // =========================================================================
  function initTheme() {
    let savedPalette = localStorage.getItem(CONFIG.paletteKey) || 'indigo';
    let savedMode = localStorage.getItem(CONFIG.themeKey);

    // Migration / compatibility check
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

    // Update Theme Active Dot color
    if (dom.themeActiveDot) {
      dom.themeActiveDot.style.background = PALETTE_COLORS[palette] || 'var(--accent)';
    }

    // Update Mode Buttons in Popover
    if (dom.modeLightBtn && dom.modeDarkBtn) {
      dom.modeLightBtn.classList.toggle('active', mode === 'light');
      dom.modeDarkBtn.classList.toggle('active', mode === 'dark');
    }

    // Update Palette Buttons in Popover
    if (dom.themePopover) {
      const paletteBtns = dom.themePopover.querySelectorAll('.palette-option-btn');
      paletteBtns.forEach(btn => {
        const p = btn.getAttribute('data-palette');
        btn.classList.toggle('active', p === palette);
      });
    }

    // Update Header Theme Icon
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
      // 1. Remove local custom posts
      localStorage.removeItem(CONFIG.storageKey);

      // 2. Clear sessionStorage
      sessionStorage.clear();

      // 3. Clean CacheStorage if available
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        } catch (cErr) {
          console.warn('CacheStorage cleanup:', cErr);
        }
      }

      // 4. Force re-fetch data/content.json with cache-busting timestamp
      const freshUrl = `${CONFIG.contentUrl}?_t=${Date.now()}`;
      let basePosts = [];

      const response = await fetch(freshUrl, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.posts)) {
          basePosts = data.posts;
        }
      }

      state.posts = basePosts;
      populateMonthFilter();
      updateMetrics();
      applyFiltersAndSort();

      // If viewing a post that no longer exists, return to archive
      if (state.currentPost) {
        const stillExists = state.posts.some(p => p.id.toLowerCase() === state.currentPost.id.toLowerCase());
        if (!stillExists) {
          navigateToArchive();
        }
      }

      showToast('Cache cleared! Fresh data synchronized with server.', 'success');
    } catch (err) {
      console.error('Error clearing cache:', err);
      showToast('Error refreshing data from server.', 'error');
    } finally {
      if (dom.clearCacheIcon) {
        dom.clearCacheIcon.classList.remove('spinning');
      }
      closeClearCacheModal();
    }
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================
  function setupEventListeners() {
    // Hash routing
    window.addEventListener('hashchange', handleRoute);

    // Clear Cache Modal Events
    if (dom.clearCacheBtn) {
      dom.clearCacheBtn.addEventListener('click', openClearCacheModal);
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

    // Search input (debounced)
    let debounceTimer;
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      dom.clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFiltersAndSort();
      }, 120);
    });

    // Clear search
    dom.clearSearchBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.searchQuery = '';
      dom.clearSearchBtn.style.display = 'none';
      applyFiltersAndSort();
      dom.searchInput.focus();
    });

    // Sort select
    dom.sortSelect.addEventListener('change', (e) => {
      state.currentSort = e.target.value;
      applyFiltersAndSort();
    });

    // Month select
    dom.monthSelect.addEventListener('change', (e) => {
      state.currentMonth = e.target.value;
      applyFiltersAndSort();
    });

    // Reset filters
    dom.resetFiltersBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.searchQuery = '';
      dom.clearSearchBtn.style.display = 'none';
      dom.sortSelect.value = 'newest';
      state.currentSort = 'newest';
      dom.monthSelect.value = 'all';
      state.currentMonth = 'all';
      applyFiltersAndSort();
    });

    // Back to Archive
    dom.backToArchiveBtn.addEventListener('click', navigateToArchive);
    dom.footerBackBtn.addEventListener('click', navigateToArchive);

    // Action buttons
    dom.copyArticleBtn.addEventListener('click', copyArticle);
    dom.downloadArticleBtn.addEventListener('click', downloadArticle);
    dom.shareArticleBtn.addEventListener('click', shareArticle);

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape closes modal, popover, or reading view
      if (e.key === 'Escape') {
        if (dom.clearCacheModal && dom.clearCacheModal.classList.contains('open')) {
          closeClearCacheModal();
          return;
        }
        if (dom.themePopover && dom.themePopover.classList.contains('open')) {
          dom.themePopover.classList.remove('open');
          return;
        }
        if (dom.readingView.style.display === 'block') {
          navigateToArchive();
        }
      }
      // '/' focuses search when in archive
      if (e.key === '/' && dom.archiveView.style.display !== 'none' && document.activeElement !== dom.searchInput) {
        e.preventDefault();
        dom.searchInput.focus();
      }
    });
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

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // =========================================================================
  // Markdown & Text Formatter
  // =========================================================================
  function renderMarkdown(text) {
    if (!text) return '';

    let out = text;

    // Normalize newlines
    out = out.replace(/\r\n/g, '\n');

    // Code blocks ```lang\ncode\n```
    const codeBlocks = [];
    out = out.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code.trim())}</code></pre>`);
      return `%%CODEBLOCK_${idx}%%`;
    });

    // Inline code `code`
    const inlineCodes = [];
    out = out.replace(/`([^`\n]+)`/g, (match, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `%%INLINECODE_${idx}%%`;
    });

    // Escape HTML for remaining markdown
    out = escapeHtml(out);

    // Headers
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    out = out.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold & Italics
    out = out.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
    out = out.replace(/_(.*?)_/g, '<em>$1</em>');

    // Horizontal Rule
    out = out.replace(/^---$/gim, '<hr>');

    // Checklists [x] and [ ]
    out = out.replace(/^- \[x\] (.*$)/gim, '<li style="list-style-type: none;">☑ $1</li>');
    out = out.replace(/^- \[ \] (.*$)/gim, '<li style="list-style-type: none;">☐ $1</li>');

    // Unordered lists
    out = out.replace(/^\* (.*$)/gim, '<li>$1</li>');
    out = out.replace(/^- (.*$)/gim, '<li>$1</li>');

    // Ordered lists
    out = out.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');

    // Wrap loose <li> groups in <ul>
    out = out.replace(/(<li>[\s\S]*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);

    // Paragraphs: split by double newlines
    const paragraphs = out.split(/\n\s*\n/);
    out = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      // Don't wrap if already header, blockquote, pre, hr, or list
      if (/^<(h[1-6]|blockquote|pre|hr|ul|ol)/i.test(p) || p.startsWith('%%CODEBLOCK_')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n\n');

    // Restore inline codes
    inlineCodes.forEach((code, idx) => {
      out = out.replace(`%%INLINECODE_${idx}%%`, code);
    });

    // Restore code blocks
    codeBlocks.forEach((block, idx) => {
      out = out.replace(`%%CODEBLOCK_${idx}%%`, block);
    });

    return out;
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  function calculateReadTime(text) {
    if (!text) return '1 min';
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recently';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
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

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

})();
