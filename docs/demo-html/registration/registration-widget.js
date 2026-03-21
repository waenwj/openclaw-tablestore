(function() {
  'use strict';
  var global = typeof window !== 'undefined' ? window : globalThis;

// --- app/registration/src/api/client.js ---
/**
 * SDK Client initialization
 */

let client = null;

/**
 * Initialize TableStore SDK client
 * @returns {Object} SDK client
 */
function initClient() {
  if (client) return client;

  if (typeof window === 'undefined' || !window.VibeTableStoreSDK) {
    throw new Error('VibeTableStoreSDK not loaded. Please include vibe-tablestore-sdk.umd.js');
  }

  client = window.VibeTableStoreSDK.createTableStoreClient({
    defaultCryptoMode: 'auto'
  });

  return client;
}

/**
 * Get existing client or throw
 * @returns {Object} SDK client
 */
function getClient() {
  if (!client) {
    return initClient();
  }
  return client;
}

/**
 * Get table instance
 * @param {string} tableId
 * @returns {Object} Table instance
 */
function getTable(tableId) {
  const c = getClient();
  return c.table(tableId, { cryptoMode: 'auto' });
}

// --- app/registration/src/state/store.js ---
/**
 * State management for registration widget
 */

// Initial state
const initialState = {
  view: 'form', // 'form' | 'success'
  formData: {},
  isSubmitting: false,
  error: null,
  validationErrors: [],
  fieldErrors: {},
  successData: null
};

let state = { ...initialState };
let listeners = [];
let renderFn = null;

/**
 * Subscribe to state changes
 * @param {Function} listener
 * @returns {Function} Unsubscribe function
 */
function subscribe(listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

/**
 * Notify all listeners
 */
function notify() {
  listeners.forEach(listener => listener(state));
  if (renderFn) {
    renderFn(state);
  }
}

/**
 * Set render function
 * @param {Function} fn
 */
function setRenderFn(fn) {
  renderFn = fn;
}

/**
 * Get current state
 * @returns {Object}
 */
function getState() {
  return { ...state };
}

/**
 * Set form field value
 * @param {string} field
 * @param {string} value
 */
function setField(field, value) {
  state.formData = {
    ...state.formData,
    [field]: value
  };
  // Clear validation errors when user types
  if (state.validationErrors.length > 0) {
    state.validationErrors = [];
  }
  // Clear field-specific error when user edits that field
  if (state.fieldErrors[field]) {
    state.fieldErrors = { ...state.fieldErrors };
    delete state.fieldErrors[field];
  }
  notify();
}

/**
 * Get form data
 * @returns {Object}
 */
function getFormData() {
  return { ...state.formData };
}

/**
 * Set validation errors
 * @param {string[]} errors
 * @param {Object} fieldErrors - field-level errors map
 */
function setValidationErrors(errors, fieldErrors = {}) {
  state.validationErrors = errors;
  state.fieldErrors = fieldErrors;
  notify();
}

/**
 * Start submitting
 */
function startSubmitting() {
  state.isSubmitting = true;
  state.error = null;
  state.validationErrors = [];
  state.fieldErrors = {};
  notify();
}

/**
 * Submit success
 * @param {Object} data
 */
function submitSuccess(data) {
  state.isSubmitting = false;
  state.successData = data;
  state.view = 'success';
  notify();
}

/**
 * Submit error
 * @param {Error} error
 */
function submitError(error) {
  state.isSubmitting = false;
  state.error = error;
  notify();
}

/**
 * Go to form page (reset or keep data)
 * @param {boolean} resetData
 */
function goToForm(resetData = false) {
  state.view = 'form';
  state.error = null;
  state.validationErrors = [];
  state.fieldErrors = {};
  if (resetData) {
    state.formData = {};
    state.successData = null;
  }
  notify();
}

/**
 * Reset form completely
 */
function resetForm() {
  state = { ...initialState };
  notify();
}

// --- app/registration/src/constants/fields.js ---
/**
 * Field constants - centralized field mapping
 * No hardcoded s1/s2/r1/r2 in business logic
 */

// Field name mapping - business name to table field
const F = {
  name: 'name',
  company: 's3',
  title: 's4',
  phone: 'phone',
  email: 'email',
  province: 's1',
  city: 's2',
  address: 'address',
  topicDay2: 'r1',
  topicDay3: 'r2',
  invoiceTitle: 's5',
  taxNo: 's6'
};

// Table ID for registration
const TABLE_ID = '395b24abaf6b4901860924ece4ad508b';

// System fields that should not be submitted
const SYSTEM_FIELDS = ['id', 'created', 'modified'];

// Required fields for form validation
// name, s3, phone, s1, s2, address, r1, r2
const REQUIRED_FIELDS = [
  F.name,
  F.company,
  F.phone,
  F.province,
  F.city,
  F.address,
  F.topicDay2,
  F.topicDay3
];

// Field display labels
const FIELD_LABELS = {
  [F.name]: '姓名',
  [F.company]: '单位',
  [F.title]: '职务',
  [F.phone]: '手机',
  [F.email]: '邮箱',
  [F.province]: '省份',
  [F.city]: '城市',
  [F.address]: '地址',
  [F.topicDay2]: '第2天议题',
  [F.topicDay3]: '第3天议题',
  [F.invoiceTitle]: '开票抬头',
  [F.taxNo]: '税号'
};

// Form field order (fixed display sequence)
// name, s3, s4, phone, email, s1, s2, address, r1, r2, s5, s6
const FIELD_ORDER = [
  F.name,
  F.company,
  F.title,
  F.phone,
  F.email,
  F.province,
  F.city,
  F.address,
  F.topicDay2,
  F.topicDay3,
  F.invoiceTitle,
  F.taxNo
];

// --- app/registration/src/constants/options.js ---
/**
 * Dropdown and radio options
 */

// Province list for s1 dropdown
const PROVINCE_OPTIONS = [
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '台湾',
  '香港',
  '澳门'
];

// Day 2 topic options for r1
const DAY2_TOPIC_OPTIONS = [
  'AI助力企业数字化营销',
  'AI与生产制造计划排程'
];

// Day 3 topic options for r2
const DAY3_TOPIC_OPTIONS = [
  'AI Agent落地最佳实践',
  'AI的持续发展路径探讨'
];

// --- app/registration/src/utils/validation.js ---

/**
 * Validate phone number format (basic China mobile check)
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Basic China mobile: 1[3-9] followed by 9 digits
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return true; // Email is optional
  if (email.trim() === '') return true;
  // Basic email pattern
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate form data
 * @param {Object} formData
 * @returns {Object} { valid: boolean, errors: string[], fieldErrors: Object }
 */
function validateForm(formData) {
  const errors = [];
  const fieldErrors = {};

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const value = formData[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      const message = `${FIELD_LABELS[field] || field}为必填项`;
      errors.push(message);
      fieldErrors[field] = message;
    }
  }

  // Validate phone format
  if (formData.phone && !isValidPhone(formData.phone)) {
    const message = '请输入正确的手机号码';
    errors.push(message);
    fieldErrors.phone = message;
  }

  // Validate email format if provided
  if (formData.email && !isValidEmail(formData.email)) {
    const message = '请输入正确的邮箱格式';
    errors.push(message);
    fieldErrors.email = message;
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors
  };
}

/**
 * Format error for display
 * @param {Error} error
 * @returns {string}
 */
function formatError(error) {
  if (!error) return '未知错误';

  // SDK error structure
  if (error.code || error.apiCode) {
    const parts = [];
    if (error.message) parts.push(error.message);
    if (error.code) parts.push(`[${error.code}]`);
    if (error.apiCode) parts.push(`API:${error.apiCode}`);
    if (error.apiMsg) parts.push(error.apiMsg);
    return parts.join(' ') || '请求失败';
  }

  return error.message || String(error);
}

// --- app/registration/src/api/registration.js ---
/**
 * Registration API operations
 * Create-only operation (no list/getById/update/remove)
 */

/**
 * Create registration record
 * @param {Object} formData - Form field values
 * @returns {Promise<Object>} Created record with id
 */
async function createRegistration(formData) {
  const table = getTable(TABLE_ID);

  // Build payload - exclude system fields
  const payload = {};
  for (const [key, value] of Object.entries(formData)) {
    // Skip system fields
    if (SYSTEM_FIELDS.includes(key)) continue;

    // Include all other fields (including empty strings for optional fields)
    if (value !== undefined && value !== null) {
      payload[key] = value;
    }
  }

  try {
    const result = await table.create(payload, { 
      cryptoMode: 'auto',
      credentials: 'include'
    });

    return {
      id: result.id,
      no: result.no,
      raw: result.raw
    };
  } catch (error) {
    // Enhance error with observable fields
    const enhancedError = new Error(error.message || '提交失败');
    enhancedError.code = error.code;
    enhancedError.apiCode = error.apiCode;
    enhancedError.apiMsg = error.apiMsg;
    enhancedError.status = error.status;
    enhancedError.raw = error;
    throw enhancedError;
  }
}

// --- app/registration/src/utils/escapeHtml.js ---
/**
 * Escape HTML special characters
 * @param {string} input
 * @returns {string}
 */
function escapeHtml(input) {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- app/registration/src/render/form.js ---

/**
 * Render form page
 * @param {HTMLElement} container - Shadow DOM container
 * @param {Object} state - Current state
 * @param {Object} store - State store with actions
 */
function renderForm(container, state, store) {
  const { formData, isSubmitting, error, fieldErrors = {} } = state;

  let html = `
    <div class="registration-container">
      <div class="form-card">
        <h1 class="form-title">2025 AI大会活动报名</h1>
  `;

  // Error banner (only for API errors, not validation errors)
  if (error) {
    html += `
      <div class="error-banner">
        <div>${formatError(error)}</div>
      </div>
    `;
  }

  // Form fields
  html += `<form id="registration-form">`;

  // Section: Basic info
  html += `<div class="section-title">基本信息</div>`;

  FIELD_ORDER.forEach((field) => {
    // Add section dividers based on field
    if (field === F.phone) {
      html += `<div class="section-title">联系信息</div>`;
    } else if (field === F.province) {
      html += `<div class="section-title">地域信息</div>`;
    } else if (field === F.topicDay2) {
      html += `<div class="section-title">议题选择</div>`;
    } else if (field === F.invoiceTitle) {
      html += `<div class="section-title">开票信息（选填）</div>`;
    }

    const value = formData[field] || '';
    const label = FIELD_LABELS[field];
    const isRequired = [
      F.name, F.company, F.phone, F.province, F.city, 
      F.address, F.topicDay2, F.topicDay3
    ].includes(field);
    const fieldError = fieldErrors[field];
    const hasError = !!fieldError;
    const errorClass = hasError ? 'error' : '';
    const groupErrorClass = hasError ? 'has-error' : '';

    html += `<div class="form-group ${groupErrorClass}">`;
    html += `<label class="form-label">${escapeHtml(label)}${isRequired ? '<span class="required">*</span>' : ''}</label>`;

    // Province dropdown (s1 must be dropdown)
    if (field === F.province) {
      html += `
        <select class="form-select ${errorClass}" name="${field}" data-field="${field}">
          <option value="">请选择省份</option>
          ${PROVINCE_OPTIONS.map(p => `<option value="${escapeHtml(p)}" ${value === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
        </select>
      `;
    }
    // Day 2 topic radio
    else if (field === F.topicDay2) {
      html += `<div class="radio-group ${errorClass}">`;
      DAY2_TOPIC_OPTIONS.forEach(option => {
        const selectedClass = value === option ? 'selected' : '';
        html += `
          <label class="radio-item ${selectedClass}" data-field="${field}" data-value="${escapeHtml(option)}">
            <input type="radio" name="${field}" value="${escapeHtml(option)}" ${value === option ? 'checked' : ''}>
            <span>${escapeHtml(option)}</span>
          </label>
        `;
      });
      html += `</div>`;
    }
    // Day 3 topic radio
    else if (field === F.topicDay3) {
      html += `<div class="radio-group ${errorClass}">`;
      DAY3_TOPIC_OPTIONS.forEach(option => {
        const selectedClass = value === option ? 'selected' : '';
        html += `
          <label class="radio-item ${selectedClass}" data-field="${field}" data-value="${escapeHtml(option)}">
            <input type="radio" name="${field}" value="${escapeHtml(option)}" ${value === option ? 'checked' : ''}>
            <span>${escapeHtml(option)}</span>
          </label>
        `;
      });
      html += `</div>`;
    }
    // Text inputs
    else {
      const inputType = field === F.email ? 'email' : 'text';
      const placeholder = getPlaceholder(field);
      html += `<input type="${inputType}" class="form-input ${errorClass}" name="${field}" data-field="${field}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`;
    }

    // Field-level error message
    if (hasError) {
      html += `<div class="field-error">${escapeHtml(fieldError)}</div>`;
    }

    html += `</div>`;
  });

  // Submit button
  html += `
    <button type="submit" class="submit-btn" ${isSubmitting ? 'disabled' : ''}>
      ${isSubmitting ? '提交中...' : '提交报名'}
    </button>
  `;

  html += `</form></div></div>`;

  container.innerHTML = html;

  // Bind events
  bindFormEvents(container, store);
}

/**
 * Bind form input events
 * @param {HTMLElement} container
 * @param {Object} store
 */
function bindFormEvents(container, store) {
  const form = container.querySelector('#registration-form');
  if (!form) return;

  // Text inputs and selects
  form.querySelectorAll('input[data-field], select[data-field]').forEach(el => {
    el.addEventListener('input', (e) => {
      const field = e.target.dataset.field;
      store.setField(field, e.target.value);
    });

    el.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      store.setField(field, e.target.value);
    });
  });

  // Radio buttons (custom styled)
  form.querySelectorAll('.radio-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Prevent triggering when clicking the input directly
      if (e.target.tagName === 'INPUT') return;

      const field = el.dataset.field;
      const value = el.dataset.value;

      // Update the radio input
      const input = el.querySelector('input[type="radio"]');
      if (input) {
        input.checked = true;
      }

      // Update visual selection
      form.querySelectorAll(`.radio-item[data-field="${field}"]`).forEach(item => {
        item.classList.remove('selected');
      });
      el.classList.add('selected');

      store.setField(field, value);
    });
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(store);
  });
}

/**
 * Handle form submission
 * @param {Object} store
 */
async function handleSubmit(store) {
  const formData = store.getFormData();

  // Client-side validation
  const validation = validateForm(formData);
  if (!validation.valid) {
    store.setValidationErrors(validation.errors, validation.fieldErrors);
    return;
  }

  store.startSubmitting();

  try {
    const result = await createRegistration(formData);
    store.submitSuccess({
      ...formData,
      id: result.id,
      created: result.raw?.created || new Date().toISOString()
    });
  } catch (error) {
    store.submitError(error);
  }
}

/**
 * Get placeholder text for field
 * @param {string} field
 * @returns {string}
 */
function getPlaceholder(field) {
  const placeholders = {
    [F.name]: '请输入姓名',
    [F.company]: '请输入单位名称',
    [F.title]: '请输入职务',
    [F.phone]: '请输入手机号码',
    [F.email]: '请输入邮箱地址',
    [F.city]: '请输入城市',
    [F.address]: '请输入详细地址',
    [F.invoiceTitle]: '请输入发票抬头',
    [F.taxNo]: '请输入纳税人识别号'
  };
  return placeholders[field] || '';
}

// --- app/registration/src/render/success.js ---

/**
 * Render success page
 * @param {HTMLElement} container - Shadow DOM container
 * @param {Object} state - Current state
 * @param {Object} store - State store with actions
 */
function renderSuccess(container, state, store) {
  const { successData } = state;

  if (!successData) {
    container.innerHTML = '<div class="registration-container"><div class="form-card">加载中...</div></div>';
    return;
  }

  const {
    [F.name]: name,
    [F.company]: company,
    [F.phone]: phone,
    [F.topicDay2]: topicDay2,
    [F.topicDay3]: topicDay3,
    id,
    created
  } = successData;

  const formattedTime = created ? formatDateTime(created) : '-';

  const html = `
    <div class="registration-container">
      <div class="form-card">
        <div class="success-container">
          <div class="success-icon">✓</div>
          <h2 class="success-title">报名成功</h2>
          <p class="success-subtitle">您的报名信息已提交，请保存以下回执信息</p>

          <div class="receipt-card">
            <div class="receipt-row">
              <span class="receipt-label">${FIELD_LABELS[F.name]}</span>
              <span class="receipt-value">${escapeHtml(name) || '-'}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">${FIELD_LABELS[F.company]}</span>
              <span class="receipt-value">${escapeHtml(company) || '-'}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">${FIELD_LABELS[F.phone]}</span>
              <span class="receipt-value">${escapeHtml(phone) || '-'}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">${FIELD_LABELS[F.topicDay2]}</span>
              <span class="receipt-value">${escapeHtml(topicDay2) || '-'}</span>
            </div>
            <div class="receipt-row">
              <span class="receipt-label">${FIELD_LABELS[F.topicDay3]}</span>
              <span class="receipt-value">${escapeHtml(topicDay3) || '-'}</span>
            </div>
            ${id ? `
              <div class="receipt-row">
                <span class="receipt-label">记录ID</span>
                <span class="receipt-value">${escapeHtml(String(id))}</span>
              </div>
            ` : ''}
            <div class="receipt-row">
              <span class="receipt-label">提交时间</span>
              <span class="receipt-value">${formattedTime}</span>
            </div>
          </div>

          <button class="back-btn" id="back-to-form">返回重新填写</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind back button
  const backBtn = container.querySelector('#back-to-form');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      store.goToForm(true); // Reset data when going back
    });
  }
}

/**
 * Format date time for display
 * @param {string} isoString
 * @returns {string}
 */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch (e) {
    return isoString;
  }
}

// --- app/registration/src/styles/index.js ---
/**
 * Shadow DOM styles - injected as <style> element
 * Dark theme - Tech, professional, high contrast blue
 */
const STYLES = `
  :host {
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #E5E7EB;
    /* Dark theme color palette - Blue primary */
    --primary-color: #3B82F6;
    --primary-hover: #1D4ED8;
    --primary-active: #1E40AF;
    --primary-light: rgba(37, 99, 235, 0.12);
    --primary-border: #3B82F6;
    /* Dark backgrounds */
    --bg-page: #0B1120;
    --bg-page-gradient: linear-gradient(180deg, #020617 0%, #0F172A 100%);
    --card-bg: #0F172A;
    --card-bg-alt: #111827;
    --section-bg: rgba(37, 99, 235, 0.12);
    --section-bg-solid: #1D324F;
    /* Input backgrounds */
    --input-bg: #020617;
    --input-bg-disabled: #111827;
    /* Text colors - High contrast on dark */
    --text-primary: #F9FAFB;
    --text-secondary: #CBD5F5;
    --text-tertiary: #9CA3AF;
    --text-title: #E5F0FF;
    --text-section: #BFDBFE;
    --placeholder-color: #6B7280;
    /* Borders */
    --border-color: #1F2937;
    --border-color-alt: #273549;
    --border-color-disabled: #374151;
    /* Error and success - High contrast on dark */
    --error-color: #F87171;
    --error-bg: rgba(239, 68, 68, 0.1);
    --error-border: #EF4444;
    --success-color: #22C55E;
    --success-bg: rgba(34, 197, 94, 0.1);
    /* Required asterisk */
    --required-color: #60A5FA;
  }

  * {
    box-sizing: border-box;
  }

  /* Page background - Dark navy */
  .registration-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    min-height: 100vh;
    background: var(--bg-page-gradient);
  }

  .form-card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 28px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.08);
  }

  .form-title {
    font-size: 22px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 28px;
    color: var(--text-title);
    letter-spacing: -0.5px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group.has-error {
    margin-bottom: 8px;
  }

  .form-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 14px;
  }

  .form-label .required {
    color: var(--required-color);
    margin-left: 4px;
    font-weight: 600;
  }

  .form-input,
  .form-select {
    width: 100%;
    padding: 11px 14px;
    border: 1px solid var(--border-color-alt);
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .form-input:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25), 0 0 12px rgba(59, 130, 246, 0.15);
  }

  .form-input:disabled,
  .form-select:disabled {
    background: var(--input-bg-disabled);
    color: var(--text-tertiary);
    border-color: var(--border-color-disabled);
    cursor: not-allowed;
  }

  .form-input.error,
  .form-select.error {
    border-color: var(--error-border);
    background-color: var(--error-bg);
  }

  .form-input.error:focus,
  .form-select.error:focus {
    border-color: var(--error-border);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
  }

  .field-error {
    color: var(--error-color);
    font-size: 12px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .field-error::before {
    content: '⚠';
    font-size: 12px;
  }

  .radio-group.has-error {
    border: 1px solid var(--error-border);
    border-radius: 8px;
    padding: 10px;
    background-color: var(--error-bg);
  }

  .form-input::placeholder {
    color: var(--placeholder-color);
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .radio-item {
    display: flex;
    align-items: center;
    padding: 12px 14px;
    border: 1px solid var(--border-color-alt);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--card-bg-alt);
  }

  .radio-item:hover {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }

  .radio-item.selected {
    border-color: var(--primary-color);
    background: var(--primary-light);
    box-shadow: 0 0 0 1px var(--primary-color), inset 0 0 8px rgba(59, 130, 246, 0.1);
  }

  .radio-item input[type="radio"] {
    margin-right: 10px;
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color);
    flex-shrink: 0;
  }

  .radio-item span {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .radio-item.selected span {
    color: var(--text-primary);
    font-weight: 500;
  }

  .submit-btn {
    width: 100%;
    padding: 14px 24px;
    margin-top: 28px;
    background: var(--primary-color);
    color: #F9FAFB;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 12px rgba(59, 130, 246, 0.35);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
  }

  .submit-btn:active:not(:disabled) {
    background: var(--primary-active);
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .submit-btn:disabled {
    background: var(--border-color);
    color: var(--text-tertiary);
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }

  .error-banner {
    background: var(--error-bg);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    color: var(--error-color);
    font-size: 14px;
  }

  .error-list {
    margin: 0;
    padding-left: 20px;
  }

  .loading-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px;
    color: var(--text-tertiary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color-alt);
    border-top: 3px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Success page styles - Dark theme */
  .success-container {
    text-align: center;
    padding: 32px 24px;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    background: var(--success-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    color: #fff;
    font-size: 32px;
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
  }

  .success-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--success-color);
    margin-bottom: 8px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .success-subtitle {
    color: var(--text-tertiary);
    margin-bottom: 32px;
    font-size: 14px;
  }

  .receipt-card {
    background: var(--card-bg-alt);
    border-radius: 10px;
    padding: 20px;
    text-align: left;
    margin-bottom: 24px;
    border: 1px solid var(--border-color);
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px dashed var(--border-color-alt);
  }

  .receipt-row:last-child {
    border-bottom: none;
  }

  .receipt-label {
    color: var(--text-tertiary);
    font-size: 14px;
  }

  .receipt-value {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 14px;
  }

  .back-btn {
    padding: 11px 32px;
    background: transparent;
    color: var(--primary-color);
    border: 1.5px solid var(--primary-color);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .back-btn:hover {
    background: var(--primary-light);
    border-color: var(--primary-hover);
    color: var(--primary-hover);
  }

  .back-btn:active {
    background: rgba(37, 99, 235, 0.2);
    transform: translateY(1px);
  }

  .section-divider {
    height: 1px;
    background: var(--border-color);
    margin: 24px 0;
  }

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-section);
    margin: 24px 0 16px 0;
    padding: 12px 14px;
    background: var(--section-bg);
    border-radius: 8px;
    border-left: 4px solid var(--primary-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .section-title:first-of-type {
    margin-top: 0;
  }
`;

// --- app/registration/src/index.js ---
/**
 * Registration Widget - Main Entry Point
 * Create-only signup flow for 2025 AI Conference
 * 
 * Field order: name, s3, s4, phone, email, s1, s2, address, r1, r2, s5, s6
 * Required: name, s3, phone, s1, s2, address, r1, r2
 * s1 must be dropdown
 */

const store = { subscribe, setRenderFn, getState, setField, getFormData, setValidationErrors, startSubmitting, submitSuccess, submitError, goToForm, resetForm };

/**
 * Create Registration Widget
 * @param {HTMLElement} target - Mount target element
 * @returns {HTMLElement} Host element
 */
function createRegistrationWidget(target) {
  const mount = target || document.body;

  // Create host element with Shadow DOM
  const host = document.createElement('registration-widget-root');
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  shadow.appendChild(styleEl);

  // Create content container
  const container = document.createElement('div');
  container.id = 'widget-container';
  shadow.appendChild(container);

  // Initialize SDK client
  try {
    initClient();
  } catch (err) {
    container.innerHTML = '<div class="registration-container"><div class="form-card"><div class="error-banner">SDK加载失败: ' + 
      (err.message || '未知错误') + '</div></div></div>';
    mount.appendChild(host);
    return host;
  }

  // Set up render function
  function render(state) {
    if (state.view === 'form') {
      renderForm(container, state, store);
    } else if (state.view === 'success') {
      renderSuccess(container, state, store);
    }
  }

  store.setRenderFn(render);

  // Initial render
  render(store.getState());

  mount.appendChild(host);
  return host;
}

// Export for UMD build
if (typeof window !== 'undefined') {
  window.createRegistrationWidget = createRegistrationWidget;
}

// mock refine note: smoke refine @ 2026-02-23T08:22:06.219Z

})();
