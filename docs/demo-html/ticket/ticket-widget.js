(function() {
  'use strict';
  var global = typeof window !== 'undefined' ? window : globalThis;

// --- app/ticket/src/constants/fields.js ---
/**
 * Field mapping constants - centralized definition
 * No hardcoded s1/r2/etc allowed in business logic
 */

// Main ticket table fields
const F = {
  id: 'id',
  ticketNo: 'i1',
  title: 's1',
  description: 's2',
  attachments: 'a1',
  type: 'r1',
  status: 'r2',
  requesterId: 'weixin_openid',
  requesterPhone: 'phone',
  requesterName: 'weixin_name',
  requesterAvatar: 'weixin_avatar',
  assigneeId: 's3',
  assigneeName: 's4',
  acceptTime: 'd1',
  resolveTime: 'd2',
  closeTime: 'd3',
  createdAt: 'created',
  updatedAt: 'modified'
};

// Reply detail table fields
const RF = {
  id: 'id',
  ticketId: 's1',
  ticketNo: 'i1',
  content: 's2',
  contentHtml: 's3',
  visibility: 'i2',
  attachments: 'a1',
  authorId: 'weixin_openid',
  authorName: 'weixin_name',
  authorNameFallback: 'name',
  authorAvatar: 'weixin_avatar',
  authorPhone: 'phone',
  authorEmail: 'email',
  authorAddress: 'address',
  createdAt: 'created'
};

// Table IDs
const TABLES = {
  main: '1fa21eafc27a4599878b4689e02b7d21',
  detail: '81a3208bcc73439dad1a946dfa9ccf6b'
};

// Status enum mapping
const STATUS_MAP = {
  new: { label: '新建', color: '#1890ff' },
  open: { label: '处理中', color: '#faad14' },
  pending: { label: '待回复', color: '#722ed1' },
  solved: { label: '已解决', color: '#52c41a' },
  closed: { label: '已关闭', color: '#8c8c8c' },
  cancelled: { label: '已取消', color: '#ff4d4f' },
  escalated: { label: '已升级', color: '#eb2f96' },
  reopened: { label: '已重开', color: '#fa8c16' }
};

// Type enum mapping
const TYPE_MAP = {
  problem: { label: '问题', color: '#ff4d4f' },
  incident: { label: '事故', color: '#faad14' },
  question: { label: '咨询', color: '#1890ff' },
  task: { label: '任务', color: '#52c41a' }
};

// Visibility mapping
const VISIBILITY_MAP = {
  0: { label: '客服可见', color: '#8c8c8c' },
  1: { label: '相关人员可见', color: '#52c41a' }
};

// Default pagination
const DEFAULT_PAGE_SIZE = 10;

// --- app/ticket/src/api/client.js ---

/**
 * SDK Client wrapper
 * Uses window.VibeTableStoreSDK
 */

let client = null;

/**
 * Initialize the SDK client
 * @param {Object} config - Client configuration
 * @returns {Object} SDK client instance
 */
function initClient(config = {}) {
  if (!window.VibeTableStoreSDK) {
    throw new Error('VibeTableStoreSDK not loaded. Please include vibe-tablestore-sdk.umd.js');
  }

  client = window.VibeTableStoreSDK.createTableStoreClient({
    defaultCryptoMode: 'auto',
    ...config
  });

  return client;
}

/**
 * Get the initialized client
 * @returns {Object} SDK client instance
 */
function getClient() {
  if (!client) {
    throw new Error('SDK client not initialized. Call initClient() first.');
  }
  return client;
}

/**
 * Get table instance
 * @param {string} tableKey - 'main' or 'detail'
 * @returns {Object} Table instance
 */
function getTable(tableKey) {
  const tableId = TABLES[tableKey];
  if (!tableId) {
    throw new Error(`Unknown table key: ${tableKey}`);
  }
  return getClient().table(tableId, { cryptoMode: 'auto' });
}

/**
 * Format error for display
 * @param {Error} error - SDK error
 * @returns {Object} Formatted error info
 */
function formatError(error) {
  const result = {
    message: error.message || 'Unknown error',
    code: error.code || 'unknown_error',
    apiCode: error.apiCode || null,
    apiMsg: error.apiMsg || null,
    status: error.status || null
  };

  // Log for observability
  console.error('[TicketWidget] API Error:', result);

  return result;
}

// --- app/ticket/src/api/ticket.js ---

/**
 * Ticket API operations
 * All field references use centralized constants
 */

/**
 * List tickets with pagination, optional status filter and keyword search
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} List result with items, page, size, total
 */
async function listTickets(params = {}) {
  const { page = 1, size = DEFAULT_PAGE_SIZE, statusFilter = null, keyword = '' } = params;

  const data = {
    sort: ['-modified', '-created']
  };

  // Build filter conditions
  const filterValues = [];

  if (statusFilter) {
    filterValues.push({ key: F.status, option: '=', value: statusFilter });
  }

  if (keyword && keyword.trim()) {
    filterValues.push({ key: F.title, option: 'like', value: keyword.trim() });
  }

  if (filterValues.length > 0) {
    data.filter = {
      statement: {
        opt: 'AND',
        values: filterValues
      }
    };
  }

  try {
    const table = getTable('main');
    const result = await table.list({ page, size, data });
    return {
      items: result.items || [],
      page: result.page || page,
      size: result.size || size,
      total: result.total || 0
    };
  } catch (error) {
    throw formatError(error);
  }
}

/**
 * Get ticket detail by ID
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Ticket object or null
 */
async function getTicketById(ticketId) {
  if (!ticketId) {
    throw { message: 'Ticket ID is required', code: 'invalid_argument' };
  }

  try {
    const table = getTable('main');
    const result = await table.getById(ticketId);
    return result;
  } catch (error) {
    throw formatError(error);
  }
}

/**
 * List replies for a ticket
 * @param {string} ticketId - Parent ticket ID
 * @param {Object} params - Pagination params
 * @returns {Promise<Object>} List result with items
 */
async function listReplies(ticketId, params = {}) {
  if (!ticketId) {
    throw { message: 'Ticket ID is required', code: 'invalid_argument' };
  }

  const { page = 1, size = 100 } = params;

  const data = {
    sort: ['created'],
    filter: {
      statement: {
        opt: 'AND',
        values: [
          { key: RF.ticketId, option: '=', value: ticketId }
        ]
      }
    }
  };

  try {
    const table = getTable('detail');
    const result = await table.list({ page, size, data });
    return {
      items: result.items || [],
      page: result.page || page,
      size: result.size || size,
      total: result.total || 0
    };
  } catch (error) {
    throw formatError(error);
  }
}

// --- app/ticket/src/state/store.js ---
/**
 * Simple state management for ticket widget
 * State contract: listState, detailState
 */

// Initial state
const initialState = {
  // View state
  currentView: 'list', // 'list' | 'detail'

  // List state (contract name: listState)
  listState: {
    items: [],
    page: 1,
    size: 10,
    total: 0,
    hasMore: true,
    statusFilter: null,
    keyword: '',
    loading: false,
    error: null
  },

  // Detail state (contract name: detailState)
  detailState: {
    ticketId: null,
    ticket: null,
    replies: [],
    loading: false,
    error: null
  }
};

// Current state
let state = { ...initialState };

// Listeners
const listeners = new Set();

/**
 * Subscribe to state changes
 * @param {Function} callback - State change callback
 * @returns {Function} Unsubscribe function
 */
function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Notify all listeners
 */
function notify() {
  const snapshot = getState();
  listeners.forEach(cb => {
    try {
      cb(snapshot);
    } catch (e) {
      console.error('[TicketWidget] State listener error:', e);
    }
  });
}

/**
 * Get current state (deep clone)
 * @returns {Object} Current state
 */
function getState() {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Set state (partial merge)
 * @param {Object} updates - State updates
 */
function setState(updates) {
  state = deepMerge(state, updates);
  notify();
}

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Reset state to initial
 */
function resetState() {
  state = { ...initialState };
  notify();
}

/**
 * Navigate to list view
 */
function navigateToList() {
  setState({
    currentView: 'list',
    detailState: {
      ticketId: null,
      ticket: null,
      replies: [],
      loading: false,
      error: null
    }
  });
}

/**
 * Navigate to detail view
 * @param {string} ticketId - Ticket ID to view
 */
function navigateToDetail(ticketId) {
  setState({
    currentView: 'detail',
    detailState: {
      ticketId,
      ticket: null,
      replies: [],
      loading: true,
      error: null
    }
  });
}

/**
 * Set list loading state
 * @param {boolean} loading - Loading flag
 */
function setListLoading(loading) {
  setState({ listState: { loading } });
}

/**
 * Set list error state
 * @param {Object|null} error - Error object or null
 */
function setListError(error) {
  setState({ listState: { error, loading: false } });
}

/**
 * Set list data (replace mode for initial load/filter change/refresh)
 * @param {Object} data - List data
 */
function setListData(data) {
  const items = data.items || [];
  const page = data.page || 1;
  const size = data.size || 10;
  const total = data.total || 0;
  // hasMore: if total is known, check if we have more; otherwise check if items length equals size
  const hasMore = total > 0 ? (page * size) < total : items.length >= size;

  setState({
    listState: {
      items: items,
      page: page,
      size: size,
      total: total,
      hasMore: hasMore,
      loading: false,
      error: null
    }
  });
}

/**
 * Append list data (append mode for lazy load/infinite scroll)
 * @param {Object} data - List data to append
 */
function appendListData(data) {
  const state = getState().listState;
  const newItems = data.items || [];
  const page = data.page || state.page + 1;
  const size = data.size || state.size;
  const total = data.total || state.total;
  // hasMore: if total is known, check if we have more; otherwise check if new items length equals size
  const hasMore = total > 0 ? (page * size) < total : newItems.length >= size;

  setState({
    listState: {
      items: [...state.items, ...newItems],
      page: page,
      size: size,
      total: total,
      hasMore: hasMore,
      loading: false,
      error: null
    }
  });
}

/**
 * Set lazy load loading state (for infinite scroll)
 * @param {boolean} loading - Loading flag
 */
function setLazyLoading(loading) {
  setState({ listState: { loading } });
}

/**
 * Set detail loading state
 * @param {boolean} loading - Loading flag
 */
function setDetailLoading(loading) {
  setState({ detailState: { loading } });
}

/**
 * Set detail error state
 * @param {Object|null} error - Error object or null
 */
function setDetailError(error) {
  setState({ detailState: { error, loading: false } });
}

/**
 * Set detail data
 * @param {Object} ticket - Ticket object
 * @param {Array} replies - Reply items
 */
function setDetailData(ticket, replies) {
  setState({
    detailState: {
      ticket,
      replies: replies || [],
      loading: false,
      error: null
    }
  });
}

/**
 * Set status filter
 * @param {string|null} status - Status filter value
 */
function setStatusFilter(status) {
  setState({
    listState: {
      statusFilter: status,
      page: 1,
      hasMore: true
    }
  });
}

/**
 * Set search keyword
 * @param {string} keyword - Search keyword
 */
function setSearchKeyword(keyword) {
  setState({
    listState: {
      keyword: keyword || '',
      page: 1,
      hasMore: true
    }
  });
}

/**
 * Go back to list (alias for navigateToList for contract compatibility)
 */
function goBack() {
  navigateToList();
}

// --- app/ticket/src/utils/helpers.js ---
/**
 * Utility helpers
 */

/**
 * Check if a node is inside an <a> tag or <img> tag
 * @param {Node} node - The text node to check
 * @returns {boolean} True if node is inside <a> or <img>
 */
function isInsideAnchorOrImage(node) {
  let parent = node.parentElement;
  while (parent) {
    if (parent.tagName === 'A' || parent.tagName === 'IMG') {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

/**
 * Convert plain text URLs to clickable links
 * Only processes text nodes, skips URLs inside <a> or <img> tags
 * @param {HTMLElement} container - Container element to process
 */
function linkifyUrls(container) {
  if (!container) return;

  // URL regex pattern - matches http/https URLs
  const urlRegex = /https?:\/\/[^\s<>"'`\)\]\}]+/gi;

  // Get all text nodes in the container
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToProcess = [];
  let textNode;
  while ((textNode = walker.nextNode())) {
    // Skip if inside <a> or <img> or if no URL in text
    if (!isInsideAnchorOrImage(textNode) && urlRegex.test(textNode.textContent)) {
      nodesToProcess.push(textNode);
    }
    // Reset regex lastIndex
    urlRegex.lastIndex = 0;
  }

  // Process collected nodes
  nodesToProcess.forEach((node) => {
    const text = node.textContent;
    const parent = node.parentNode;

    // Reset regex
    urlRegex.lastIndex = 0;

    const fragments = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before URL
      if (match.index > lastIndex) {
        fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      // Create link element for URL
      const link = document.createElement('a');
      link.href = match[0];
      link.textContent = match[0];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.cssText = 'color: #1890ff; text-decoration: underline;';
      fragments.push(link);

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace original node with fragments
    if (fragments.length > 0) {
      fragments.forEach((fragment) => {
        parent.insertBefore(fragment, node);
      });
      parent.removeChild(node);
    }
  });
}

/**
 * Format date string to locale string (4-digit year)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Raw text
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get nested value from object
 * @param {Object} obj - Source object
 * @param {string} path - Dot notation path
 * @param {*} defaultValue - Default value
 * @returns {*} Value or default
 */
function getValue(obj, path, defaultValue = '') {
  if (!obj || !path) return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  return result !== undefined ? result : defaultValue;
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Create element with attributes and children
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes
 * @param {Array} children - Child elements or strings
 * @returns {HTMLElement} Created element
 */
function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

// --- app/ticket/src/render/listView.js ---

// listState contract: items, page, size, total, statusFilter, loading, error

/**
 * Render ticket list view
 * Uses listState from store
 */

/**
 * Render loading state
 * @returns {HTMLElement} Loading container
 */
function renderLoading() {
  return createElement('div', { className: 'loading-container' }, [
    createElement('div', { className: 'loading-spinner' }),
    '加载中...'
  ]);
}

/**
 * Render error state with retry button
 * @param {Object} error - Error object
 * @param {Function} onRetry - Retry callback
 * @returns {HTMLElement} Error container
 */
function renderError(error, onRetry) {
  const errorCode = error.code || 'unknown';
  const errorMsg = error.message || '加载失败';
  const apiDetail = error.apiMsg ? `(${error.apiMsg})` : '';

  return createElement('div', { className: 'error-container' }, [
    createElement('div', { className: 'error-icon' }, '⚠️'),
    createElement('div', { className: 'error-message' }, escapeHtml(errorMsg)),
    createElement('div', { className: 'error-detail' }, 
      `Code: ${escapeHtml(errorCode)} ${escapeHtml(apiDetail)}`.trim()
    ),
    createElement('button', { 
      className: 'retry-btn',
      onClick: onRetry 
    }, '重试')
  ]);
}

/**
 * Render empty state
 * @returns {HTMLElement} Empty container
 */
function renderEmpty() {
  return createElement('div', { className: 'empty-container' }, [
    createElement('div', { className: 'empty-icon' }, '📭'),
    '暂无工单'
  ]);
}

/**
 * Render status badge
 * @param {string} status - Status code
 * @returns {HTMLElement} Status badge element
 */
function renderStatusBadge(status) {
  const config = STATUS_MAP[status] || { label: status, color: '#999' };
  return createElement('span', {
    className: 'ticket-status',
    style: `background: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color}40;`
  }, config.label);
}

/**
 * Render ticket card
 * @param {Object} ticket - Ticket data
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Ticket card
 */
function renderTicketCard(ticket, onClick) {
  const title = ticket[F.title] || '无标题';
  const requester = ticket[F.requesterName] || '未知用户';
  const status = ticket[F.status] || 'new';
  const updatedAt = ticket[F.updatedAt];

  const card = createElement('div', {
    className: 'ticket-card',
    onClick: () => onClick(ticket[F.id])
  }, [
    createElement('div', { className: 'ticket-header' }, [
      createElement('div', { className: 'ticket-title', title: title }, escapeHtml(title)),
      renderStatusBadge(status)
    ]),
    createElement('div', { className: 'ticket-meta' }, [
      createElement('div', { className: 'ticket-requester' }, [
        createElement('div', { className: 'requester-avatar' }, requester.charAt(0).toUpperCase()),
        createElement('span', { className: 'requester-name', title: requester }, escapeHtml(requester))
      ]),
      createElement('div', { className: 'ticket-time' }, formatDate(updatedAt))
    ])
  ]);

  return card;
}

/**
 * Render toolbar with filter, search and refresh
 * @param {Object} listState - List state
 * @param {Function} onFilterChange - Filter change handler
 * @param {Function} onSearchChange - Search change handler
 * @param {Function} onRefresh - Refresh handler
 * @returns {HTMLElement} Toolbar element
 */
function renderToolbar(listState, onFilterChange, onSearchChange, onRefresh) {
  const options = [
    { value: '', label: '全部状态' },
    ...Object.entries(STATUS_MAP).map(([key, config]) => ({
      value: key,
      label: config.label
    }))
  ];

  const select = createElement('select', {
    className: 'filter-select',
    value: listState.statusFilter || '',
    onChange: (e) => onFilterChange(e.target.value || null)
  }, options.map(opt => 
    createElement('option', { value: opt.value }, opt.label)
  ));

  // Set initial value
  select.value = listState.statusFilter || '';

  // Search input
  const searchInput = createElement('input', {
    className: 'search-input',
    type: 'text',
    placeholder: '搜索标题...',
    value: listState.keyword || '',
    onInput: (e) => onSearchChange(e.target.value)
  });

  return createElement('div', { className: 'toolbar' }, [
    select,
    searchInput,
    createElement('button', {
      className: 'refresh-btn',
      disabled: listState.loading,
      onClick: onRefresh
    }, listState.loading ? '刷新中...' : '🔄 刷新')
  ]);
}

/**
 * Render lazy load indicator (bottom loading state)
 * @param {Object} listState - List state
 * @returns {HTMLElement|null} Loading indicator element
 */
function renderLazyLoadIndicator(listState) {
  // Show loading indicator when loading more items (not initial load)
  if (listState.loading && listState.items.length > 0) {
    return createElement('div', { className: 'lazyload-indicator' }, [
      createElement('div', { className: 'lazyload-spinner' }),
      '加载中...'
    ]);
  }

  // Show "no more" message when hasMore is false and we have items
  if (!listState.hasMore && listState.items.length > 0) {
    return createElement('div', { className: 'lazyload-end' }, '没有更多了');
  }

  return null;
}

/**
 * Render ticket list
 * @param {Object} listState - List state
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} List container
 */
function renderTicketList(listState, handlers) {
  const { onTicketClick, onFilterChange, onSearchChange, onRefresh } = handlers;

  const container = createElement('div', { 
    className: 'list-container',
    id: 'ticket-list-container'
  });

  // Toolbar
  container.appendChild(renderToolbar(listState, onFilterChange, onSearchChange, onRefresh));

  // Content area
  if (listState.loading && listState.items.length === 0) {
    container.appendChild(renderLoading());
  } else if (listState.error) {
    container.appendChild(renderError(listState.error, onRefresh));
  } else if (listState.items.length === 0) {
    container.appendChild(renderEmpty());
  } else {
    const listEl = createElement('div', { className: 'ticket-list' });
    for (const ticket of listState.items) {
      listEl.appendChild(renderTicketCard(ticket, onTicketClick));
    }
    container.appendChild(listEl);

    // Lazy load indicator (at bottom)
    const lazyIndicator = renderLazyLoadIndicator(listState);
    if (lazyIndicator) {
      container.appendChild(lazyIndicator);
    }
  }

  return container;
}

// --- app/ticket/src/render/detailView.js ---

// detailState contract: ticketId, ticket, replies, loading, error

// Image preview state - per shadow root
const previewState = new WeakMap();

/**
 * Get or create preview state for a shadow root
 * @param {ShadowRoot} shadowRoot - Shadow root
 * @returns {Object} Preview state
 */
function getPreviewState(shadowRoot) {
  if (!previewState.has(shadowRoot)) {
    previewState.set(shadowRoot, { currentOverlay: null });
  }
  return previewState.get(shadowRoot);
}

/**
 * Render ticket detail view
 * Uses detailState from store
 */

/**
 * Open image preview modal within Shadow DOM
 * @param {string} src - Image source URL
 * @param {ShadowRoot} shadowRoot - Shadow root to append overlay to
 */
function openImagePreview(src, shadowRoot) {
  if (!shadowRoot) return;

  const state = getPreviewState(shadowRoot);

  // Close any existing preview
  closeImagePreview(shadowRoot);

  const overlay = createElement('div', { className: 'image-preview-overlay' });
  const container = createElement('div', { className: 'image-preview-container' });
  const img = createElement('img', {
    className: 'image-preview-img',
    src: src,
    alt: '预览图片'
  });
  const closeBtn = createElement('button', { className: 'image-preview-close' }, '×');

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeImagePreview(shadowRoot);
    }
  });

  // Close on close button click
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeImagePreview(shadowRoot);
  });

  // Close on Escape key - attach to shadow host's owner document
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeImagePreview(shadowRoot);
    }
  };
  // Use document for keyboard events since shadow DOM doesn't capture all key events
  document.addEventListener('keydown', handleKeyDown);

  // Store reference for cleanup
  overlay._keyDownHandler = handleKeyDown;
  state.currentOverlay = overlay;

  container.appendChild(closeBtn);
  container.appendChild(img);
  overlay.appendChild(container);
  // Append to shadow root instead of document.body
  shadowRoot.appendChild(overlay);
}

/**
 * Close image preview modal
 * @param {ShadowRoot} shadowRoot - Shadow root
 */
function closeImagePreview(shadowRoot) {
  if (!shadowRoot) return;

  const state = getPreviewState(shadowRoot);
  if (state.currentOverlay) {
    const handler = state.currentOverlay._keyDownHandler;
    if (handler) {
      document.removeEventListener('keydown', handler);
    }
    state.currentOverlay.remove();
    state.currentOverlay = null;
  }
}

/**
 * Setup image click handlers for preview
 * @param {HTMLElement} container - Container element with images
 * @param {ShadowRoot} shadowRoot - Shadow root for overlay
 */
function setupImagePreview(container, shadowRoot) {
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const src = img.getAttribute('src');
      if (src && shadowRoot) {
        openImagePreview(src, shadowRoot);
      }
    });
  });
}

/**
 * Render loading state
 * @returns {HTMLElement} Loading container
 */
function renderDetailLoading() {
  return createElement('div', { className: 'loading-container' }, [
    createElement('div', { className: 'loading-spinner' }),
    '加载中...'
  ]);
}

/**
 * Render error state with retry button
 * @param {Object} error - Error object
 * @param {Function} onRetry - Retry callback
 * @returns {HTMLElement} Error container
 */
function renderDetailError(error, onRetry) {
  const errorCode = error.code || 'unknown';
  const errorMsg = error.message || '加载失败';
  const apiDetail = error.apiMsg ? `(${error.apiMsg})` : '';

  return createElement('div', { className: 'error-container' }, [
    createElement('div', { className: 'error-icon' }, '⚠️'),
    createElement('div', { className: 'error-message' }, escapeHtml(errorMsg)),
    createElement('div', { className: 'error-detail' }, 
      `Code: ${escapeHtml(errorCode)} ${escapeHtml(apiDetail)}`.trim()
    ),
    createElement('button', { 
      className: 'retry-btn',
      onClick: onRetry 
    }, '重试')
  ]);
}

/**
 * Render info row
 * @param {string} label - Label text
 * @param {string} value - Value text
 * @returns {HTMLElement} Info row
 */
function renderInfoRow(label, value) {
  // value can be a string or an HTMLElement; wrap in array for createElement
  const valueChildren = (value instanceof Node) ? [value] : [String(value || '')];
  return createElement('div', { className: 'info-row' }, [
    createElement('div', { className: 'info-label' }, label),
    createElement('div', { className: 'info-value' }, valueChildren)
  ]);
}

/**
 * Render status badge
 * @param {string} status - Status code
 * @returns {HTMLElement} Status badge
 */
function renderStatusBadge(status) {
  const config = STATUS_MAP[status] || { label: status, color: '#999' };
  return createElement('span', {
    className: 'ticket-status',
    style: `background: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color}40; padding: 2px 8px; border-radius: 4px; font-size: 12px;`
  }, config.label);
}

/**
 * Render type badge
 * @param {string} type - Type code
 * @returns {HTMLElement} Type badge
 */
function renderTypeBadge(type) {
  const config = TYPE_MAP[type] || { label: type, color: '#999' };
  return createElement('span', {
    style: `background: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color}40; padding: 2px 8px; border-radius: 4px; font-size: 12px;`
  }, config.label);
}

/**
 * Render ticket info card
 * @param {Object} ticket - Ticket data
 * @param {ShadowRoot} shadowRoot - Shadow root for image preview
 * @returns {HTMLElement} Info card
 */
function renderTicketInfo(ticket, shadowRoot) {
  const title = ticket[F.title] || '无标题';
  const description = ticket[F.description] || '';
  const type = ticket[F.type] || 'problem';
  const status = ticket[F.status] || 'new';
  const requester = ticket[F.requesterName] || '未知用户';
  const requesterPhone = ticket[F.requesterPhone] || '';
  const assignee = ticket[F.assigneeName] || '未分配';
  const createdAt = ticket[F.createdAt];
  const updatedAt = ticket[F.updatedAt];

  const card = createElement('div', { className: 'info-card' }, [
    createElement('div', { className: 'info-title' }, escapeHtml(title)),
    renderInfoRow('类型', renderTypeBadge(type)),
    renderInfoRow('状态', renderStatusBadge(status)),
    renderInfoRow('提交人', escapeHtml(requester)),
    renderInfoRow('手机号', escapeHtml(requesterPhone) || '-'),
    renderInfoRow('受理客服', escapeHtml(assignee)),
    renderInfoRow('创建时间', formatDate(createdAt)),
    renderInfoRow('更新时间', formatDate(updatedAt))
  ]);

  if (description) {
    const descEl = createElement('div', { className: 'info-description' });
    // Handle HTML content in description (similar to reply content)
    const decodedDesc = decodeHtmlEntities(description);
    if (isHtmlContent(decodedDesc)) {
      descEl.innerHTML = decodedDesc;
    } else {
      // Plain text - preserve line breaks
      const lines = decodedDesc.split('\n');
      lines.forEach((line, index) => {
        descEl.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
          descEl.appendChild(document.createElement('br'));
        }
      });
    }
    // Setup image preview for description images
    setupImagePreview(descEl, shadowRoot);
    // Convert plain text URLs to clickable links (preserves <a> and <img> URLs)
    linkifyUrls(descEl);
    card.appendChild(descEl);
  }

  return card;
}

/**
 * Render visibility badge
 * @param {number} visibility - Visibility code
 * @returns {HTMLElement} Visibility badge
 */
function renderVisibilityBadge(visibility) {
  const config = VISIBILITY_MAP[visibility] || { label: String(visibility), color: '#999' };
  return createElement('span', {
    className: 'reply-visibility',
    style: `background: ${config.color}20; color: ${config.color}; border: 1px solid ${config.color}40;`
  }, config.label);
}

/**
 * Decode HTML entities to normal characters
 * Handles cases where HTML content is double-encoded (e.g., &amp;lt;p&amp;gt; -> <p>)
 * @param {string} html - HTML string that may contain encoded entities
 * @returns {string} Decoded HTML
 */
function decodeHtmlEntities(html) {
  if (!html) return '';
  let decoded = html;
  // Handle double-encoded entities by repeatedly decoding until stable
  // This handles: &amp;lt;p&amp;gt; -> &lt;p&gt; -> <p>
  for (let i = 0; i < 3; i++) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = decoded;
    const newDecoded = textarea.value;
    if (newDecoded === decoded) break;
    decoded = newDecoded;
  }
  return decoded;
}

/**
 * Check if content appears to be HTML (contains HTML tags)
 * @param {string} content - Content to check
 * @returns {boolean} True if content looks like HTML
 */
function isHtmlContent(content) {
  if (!content) return false;
  // Check for common HTML patterns (tags like <p>, <div>, <br>, etc.)
  return /<[a-z][\s\S]*?>/i.test(content);
}

/**
 * Render reply content with proper HTML handling
 * Fixes double-encoded HTML entities that appear as "乱码"
 * @param {string} content - Raw content (may be HTML or plain text)
 * @param {ShadowRoot} shadowRoot - Shadow root for image preview
 * @returns {HTMLElement} Content element
 */
function renderReplyContent(content, shadowRoot) {
  const contentEl = createElement('div', { className: 'reply-content' });

  if (!content) {
    contentEl.textContent = '无内容';
    return contentEl;
  }

  // First decode any HTML entities (handles double-encoding issues like &amp;lt;p&amp;gt; -> <p>)
  let decodedContent = decodeHtmlEntities(content);

  // If after decoding it looks like HTML, use innerHTML to render it properly
  // Otherwise use textContent for plain text
  if (isHtmlContent(decodedContent)) {
    contentEl.innerHTML = decodedContent;
  } else {
    // Plain text - preserve line breaks
    const lines = decodedContent.split('\n');
    lines.forEach((line, index) => {
      contentEl.appendChild(document.createTextNode(line));
      if (index < lines.length - 1) {
        contentEl.appendChild(document.createElement('br'));
      }
    });
  }

  // Setup image preview for reply content images
  setupImagePreview(contentEl, shadowRoot);
  // Convert plain text URLs to clickable links (preserves <a> and <img> URLs)
  linkifyUrls(contentEl);

  return contentEl;
}

/**
 * Render reply card
 * @param {Object} reply - Reply data
 * @param {ShadowRoot} shadowRoot - Shadow root for image preview
 * @returns {HTMLElement} Reply card
 */
function renderReplyCard(reply, shadowRoot) {
  // 优先使用 weixin_name，如果没有则使用 name 字段
  const author = reply[RF.authorName] || reply[RF.authorNameFallback] || '未知用户';
  const content = reply[RF.contentHtml] || reply[RF.content] || '';
  const visibility = reply[RF.visibility] || 0;
  const createdAt = reply[RF.createdAt];

  const contentEl = renderReplyContent(content, shadowRoot);

  return createElement('div', { className: 'reply-card' }, [
    createElement('div', { className: 'reply-header' }, [
      createElement('div', { className: 'reply-author' }, [
        createElement('div', { className: 'author-avatar' }, author.charAt(0).toUpperCase()),
        createElement('div', { className: 'author-info' }, [
          createElement('div', { className: 'author-name' }, escapeHtml(author)),
          createElement('div', { className: 'reply-time' }, formatDate(createdAt))
        ])
      ]),
      renderVisibilityBadge(visibility)
    ]),
    contentEl
  ]);
}

/**
 * Render reply list
 * @param {Array} replies - Reply items
 * @param {ShadowRoot} shadowRoot - Shadow root for image preview
 * @returns {HTMLElement} Reply section
 */
function renderReplyList(replies, shadowRoot) {
  const container = createElement('div', { className: 'reply-section' }, [
    createElement('div', { className: 'section-title' }, `回复列表 (${replies.length})`)
  ]);

  if (replies.length === 0) {
    container.appendChild(createElement('div', { className: 'no-replies' }, '暂无回复'));
  } else {
    const listEl = createElement('div', { className: 'reply-list' });
    for (const reply of replies) {
      listEl.appendChild(renderReplyCard(reply, shadowRoot));
    }
    container.appendChild(listEl);
  }

  return container;
}

/**
 * Render detail header
 * @param {Function} onBack - Back button handler
 * @returns {HTMLElement} Header element
 */
function renderHeader(onBack) {
  return createElement('div', { className: 'detail-header' }, [
    createElement('button', {
      className: 'back-btn',
      onClick: onBack
    }, '← 返回列表'),
    createElement('div', { className: 'detail-title' }, '工单详情')
  ]);
}

/**
 * Render ticket detail
 * @param {Object} detailState - Detail state
 * @param {Object} handlers - Event handlers
 * @param {ShadowRoot} shadowRoot - Shadow root for image preview overlay
 * @returns {HTMLElement} Detail container
 */
function renderTicketDetail(detailState, handlers, shadowRoot) {
  const { onBack, onRetry } = handlers;

  const container = createElement('div', { className: 'detail-container' });

  // Header
  container.appendChild(renderHeader(onBack));

  // Content
  if (detailState.loading) {
    container.appendChild(renderDetailLoading());
  } else if (detailState.error) {
    container.appendChild(renderDetailError(detailState.error, onRetry));
  } else if (detailState.ticket) {
    const contentEl = createElement('div', { className: 'detail-content' });
    contentEl.appendChild(renderTicketInfo(detailState.ticket, shadowRoot));
    contentEl.appendChild(renderReplyList(detailState.replies, shadowRoot));
    container.appendChild(contentEl);
  }

  return container;
}

// --- app/ticket/src/render/index.js ---

// --- app/ticket/src/styles/index.js ---
/**
 * Shadow DOM styles - injected as <style> element
 */
const widgetStyles = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
    --primary-color: #1890ff;
    --success-color: #52c41a;
    --warning-color: #faad14;
    --error-color: #ff4d4f;
    --text-color: #333;
    --text-secondary: #666;
    --text-muted: #999;
    --border-color: #e8e8e8;
    --bg-color: #f5f5f5;
    --card-bg: #fff;
    --shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  * {
    box-sizing: border-box;
  }

  /* Loading State */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Error State */
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-message {
    color: var(--error-color);
    margin-bottom: 8px;
    font-weight: 500;
  }

  .error-detail {
    color: var(--text-muted);
    font-size: 12px;
    margin-bottom: 16px;
    word-break: break-all;
  }

  .retry-btn {
    padding: 8px 24px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .retry-btn:hover {
    opacity: 0.9;
  }

  .retry-btn:active {
    opacity: 0.8;
  }

  /* Empty State */
  .empty-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  /* List View */
  .list-container {
    background: var(--bg-color);
    min-height: 100%;
    max-height: 100vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .filter-select {
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: white;
    font-size: 14px;
    min-width: 100px;
  }

  .search-input {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: white;
    font-size: 14px;
    margin: 0 8px;
    min-width: 100px;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .refresh-btn {
    padding: 6px 16px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .refresh-btn:hover {
    opacity: 0.9;
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ticket-list {
    padding: 8px;
  }

  .ticket-card {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 8px;
    box-shadow: var(--shadow);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .ticket-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .ticket-title {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color);
    flex: 1;
    margin-right: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ticket-status {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .ticket-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-secondary);
    font-size: 13px;
  }

  .ticket-requester {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 180px;
    min-width: 0;
  }

  .requester-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    flex-shrink: 0;
  }

  .requester-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .ticket-time {
    color: var(--text-muted);
  }

  /* Lazy Load Indicator */
  .lazyload-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
    gap: 8px;
  }

  .lazyload-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .lazyload-end {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* Detail View */
  .detail-container {
    background: var(--bg-color);
    min-height: 100%;
  }

  .detail-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: var(--card-bg);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .back-btn {
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .back-btn:hover {
    background: var(--bg-color);
  }

  .detail-title {
    flex: 1;
    text-align: center;
    font-weight: 500;
    margin: 0 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-content {
    padding: 12px;
  }

  .info-card {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
  }

  .info-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text-color);
  }

  .info-row {
    display: flex;
    margin-bottom: 12px;
  }

  .info-label {
    width: 80px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .info-value {
    flex: 1;
    color: var(--text-color);
  }

  .info-description {
    background: var(--bg-color);
    padding: 12px;
    border-radius: 4px;
    margin-top: 12px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    padding: 0 4px;
    color: var(--text-color);
  }

  .reply-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reply-card {
    background: var(--card-bg);
    border-radius: 8px;
    padding: 16px;
    box-shadow: var(--shadow);
  }

  .reply-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .reply-author {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .author-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-weight: 500;
    color: var(--text-color);
  }

  .reply-time {
    font-size: 12px;
    color: var(--text-muted);
  }

  .reply-visibility {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .reply-content {
    color: var(--text-color);
    line-height: 1.6;
    word-break: break-word;
    overflow-x: auto;
  }

  .reply-content p {
    margin: 0 0 8px 0;
  }

  .reply-content p:last-child {
    margin-bottom: 0;
  }

  .reply-content img {
    max-width: 150px;
    height: auto;
    display: block;
    margin: 16px 0;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .reply-content img:hover {
    opacity: 0.9;
  }

  .info-description img {
    max-width: 150px;
    height: auto;
    display: block;
    margin: 16px 0;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .info-description img:hover {
    opacity: 0.9;
  }

  .no-replies {
    text-align: center;
    padding: 32px;
    color: var(--text-muted);
  }

  /* Image Preview Modal */
  .image-preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    cursor: zoom-out;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .image-preview-container {
    position: relative;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-preview-img {
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 4px;
    animation: zoomIn 0.2s ease;
  }

  @keyframes zoomIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .image-preview-close {
    position: absolute;
    top: -40px;
    right: 0;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .image-preview-close:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;
widgetStyles;

// --- app/ticket/src/index.js ---
/**
 * Ticket Widget - Shadow DOM Component
 * UMD SDK based implementation
 */

/**
 * Match reply by ticket keys for isolation
 * @param {Object} reply - Reply object
 * @param {Set} ticketKeys - Set of valid ticket IDs
 * @returns {boolean} Whether reply belongs to ticket
 */
function matchReplyByTicket(reply, ticketKeys) {
  const ticketIdField = 's1'; // RF.ticketId
  return ticketKeys.has(reply[ticketIdField]);
}

/**
 * TicketWidget class - Web Component with Shadow DOM
 */
class TicketWidget extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.unsubscribe = null;
    this.sdkConfig = {};
    this._scrollHandler = null;
    this._isLoadingMore = false;
    this._scrollThreshold = 100; // pixels from bottom to trigger load
  }

  static get observedAttributes() {
    return ['sdk-config'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'sdk-config' && newValue) {
      try {
        this.sdkConfig = JSON.parse(newValue);
      } catch (e) {
        console.error('[TicketWidget] Invalid sdk-config:', e);
      }
    }
  }

  connectedCallback() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = widgetStyles;
    this.shadow.appendChild(styleEl);

    // Create container
    this.container = document.createElement('div');
    this.container.style.width = '100%';
    this.container.style.minHeight = '100%';
    this.shadow.appendChild(this.container);

    // Initialize SDK
    try {
      initClient(this.sdkConfig);
    } catch (e) {
      this.renderError({ message: e.message, code: 'init_error' });
      return;
    }

    // Subscribe to state changes
    this.unsubscribe = subscribe((state) => this.render(state));

    // Load initial data
    this.loadTickets();
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this._removeScrollHandler();
  }

  /**
   * Setup scroll handler for lazy load
   */
  _setupScrollHandler() {
    this._removeScrollHandler();

    const listContainer = this.shadow.getElementById('ticket-list-container');
    if (!listContainer) return;

    this._scrollHandler = () => this._handleScroll();
    listContainer.addEventListener('scroll', this._scrollHandler);
  }

  /**
   * Remove scroll handler
   */
  _removeScrollHandler() {
    if (this._scrollHandler && this.container) {
      const listContainer = this.shadow.getElementById('ticket-list-container');
      if (listContainer) {
        listContainer.removeEventListener('scroll', this._scrollHandler);
      }
    }
    this._scrollHandler = null;
  }

  /**
   * Handle scroll event for lazy load
   */
  _handleScroll() {
    const state = getState();

    // Only handle scroll in list view
    if (state.currentView !== 'list') return;

    const listState = state.listState;

    // Skip if already loading, no more data, or has error
    if (listState.loading || !listState.hasMore || listState.error) return;

    // Prevent concurrent requests
    if (this._isLoadingMore) return;

    const listContainer = this.shadow.getElementById('ticket-list-container');
    if (!listContainer) return;

    // Check if scrolled near bottom
    const scrollTop = listContainer.scrollTop;
    const scrollHeight = listContainer.scrollHeight;
    const clientHeight = listContainer.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - this._scrollThreshold) {
      this._loadMoreTickets();
    }
  }

  /**
   * Load more tickets for lazy load
   */
  async _loadMoreTickets() {
    if (this._isLoadingMore) return;

    const state = getState().listState;

    // Double check conditions
    if (state.loading || !state.hasMore) return;

    this._isLoadingMore = true;
    setLazyLoading(true);

    try {
      const nextPage = state.page + 1;
      const result = await listTickets({
        page: nextPage,
        size: state.size,
        statusFilter: state.statusFilter,
        keyword: state.keyword
      });

      appendListData({
        ...result,
        page: nextPage
      });
    } catch (error) {
      // On error, just stop loading but keep existing items
      setLazyLoading(false);
      console.error('[TicketWidget] Lazy load error:', error);
    } finally {
      this._isLoadingMore = false;
    }
  }

  /**
   * Render based on current state
   * @param {Object} state - App state
   */
  render(state) {
    if (!this.container) return;

    // Save scroll position before re-rendering (for list view lazy load)
    // This handles both: lazy load START (loading=true, has items) and lazy load END (loading=false, has items)
    const isListView = state.currentView === 'list';
    const hasItems = state.listState.items.length > 0;
    const shouldSaveScroll = isListView && hasItems;
    let savedScrollTop = 0;
    if (shouldSaveScroll) {
      const listContainer = this.shadow.getElementById('ticket-list-container');
      if (listContainer) {
        savedScrollTop = listContainer.scrollTop;
      }
    }

    // Clear container
    this.container.innerHTML = '';

    const view = state.currentView;

    if (view === 'list') {
      const handlers = {
        onTicketClick: (ticketId) => this.handleTicketClick(ticketId),
        onFilterChange: (status) => this.handleFilterChange(status),
        onSearchChange: (keyword) => this.handleSearchChange(keyword),
        onRefresh: () => this.handleRefresh()
      };
      this.container.appendChild(renderTicketList(state.listState, handlers));

      // Restore scroll position after lazy load render (both start and end of lazy load)
      if (shouldSaveScroll && savedScrollTop > 0) {
        setTimeout(() => {
          const listContainer = this.shadow.getElementById('ticket-list-container');
          if (listContainer) {
            listContainer.scrollTop = savedScrollTop;
          }
        }, 0);
      }

      // Setup scroll handler for lazy load after DOM update
      setTimeout(() => this._setupScrollHandler(), 0);
    } else if (view === 'detail') {
      const handlers = {
        onBack: () => this.handleBack(),
        onRetry: () => this.handleDetailRetry()
      };
      this.container.appendChild(renderTicketDetail(state.detailState, handlers, this.shadow));
    }
  }

  /**
   * Render error state
   * @param {Object} error - Error object
   */
  renderError(error) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-message">${error.message || '初始化失败'}</div>
        <div class="error-detail">Code: ${error.code || 'unknown'}</div>
      </div>
    `;
  }

  /**
   * Load ticket list
   */
  async loadTickets() {
    const state = getState().listState;
    setListLoading(true);

    try {
      const result = await listTickets({
        page: state.page,
        size: state.size,
        statusFilter: state.statusFilter,
        keyword: state.keyword
      });
      setListData(result);
    } catch (error) {
      setListError(error);
    }
  }

  /**
   * Load ticket detail
   * @param {string} ticketId - Ticket ID
   */
  async loadTicketDetail(ticketId) {
    setDetailLoading(true);

    try {
      const [ticket, repliesResult] = await Promise.all([
        getTicketById(ticketId),
        listReplies(ticketId)
      ]);

      // Reply isolation: filter replies by ticketId
      const ticketKeys = new Set([ticketId]);
      const resolvedReplies = repliesResult.items || [];
      const filteredReplies = resolvedReplies.filter((reply) => matchReplyByTicket(reply, ticketKeys));

      setDetailData(ticket, filteredReplies);
    } catch (error) {
      setDetailError(error);
    }
  }

  /**
   * Handle ticket click
   * @param {string} ticketId - Ticket ID
   */
  handleTicketClick(ticketId) {
    navigateToDetail(ticketId);
    this.loadTicketDetail(ticketId);
  }

  /**
   * Handle back button - uses goBack for contract compliance
   */
  handleBack() {
    goBack();
  }

  /**
   * Handle filter change
   * @param {string|null} status - Status filter
   */
  handleFilterChange(status) {
    setStatusFilter(status);
    this.loadTickets();
  }

  /**
   * Handle search change
   * @param {string} keyword - Search keyword
   */
  handleSearchChange(keyword) {
    setSearchKeyword(keyword);
    // Debounce search to avoid too many requests
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }
    this._searchTimeout = setTimeout(() => {
      this.loadTickets();
    }, 300);
  }

  /**
   * Handle refresh button
   */
  handleRefresh() {
    this.loadTickets();
  }

  /**
   * Handle detail retry
   */
  handleDetailRetry() {
    const state = getState().detailState;
    if (state.ticketId) {
      this.loadTicketDetail(state.ticketId);
    }
  }
}

// Define custom element
customElements.define('ticket-widget-root', TicketWidget);

// Export for module usage

// Default export
TicketWidget;

// mock refine note: smoke refine @ 2026-02-23T07:25:56.816Z

})();
