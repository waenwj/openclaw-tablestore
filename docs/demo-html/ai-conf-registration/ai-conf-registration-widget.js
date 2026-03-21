(function () {
  'use strict';
  var global = typeof window !== 'undefined' ? window : globalThis;

  // =====================================================================
  // Config — replace with actual table ID
  // =====================================================================
  var TABLE_ID = '395b24abaf6b4901860924ece4ad508b';

  // =====================================================================
  // SDK 初始化
  // =====================================================================
  var client = null;

  function initClient() {
    if (client) return client;
    if (!global.VibeTableStoreSDK) {
      throw new Error('VibeTableStoreSDK not loaded');
    }
    client = global.VibeTableStoreSDK.createTableStoreClient({
      defaultCryptoMode: 'auto'
    });
    return client;
  }

  function getTable() {
    return initClient().table(TABLE_ID, { cryptoMode: 'auto' });
  }

  // =====================================================================
  // 状态机：form | submitting | success | error
  // =====================================================================
  var currentState = 'form';
  var errorMessage = '';

  // =====================================================================
  // API 调用
  // =====================================================================
  async function submitRegistration(formData) {
    var table = getTable();
    var result = await table.create(formData, {
      cryptoMode: 'encrypted',
      credentials: 'include'
    });
    return result;
  }

  // =====================================================================
  // 渲染 — 表单
  // =====================================================================
  function renderForm(container) {
    var html = '<div class="form-root">';

    // 标题
    html += '<h2 class="form-title">2025 AI大会活动报名</h2>';
    html += '<p class="form-subtitle">请填写以下信息完成报名</p>';

    // 基本信息
    html += '<fieldset class="form-fieldset"><legend>基本信息</legend>';

    html += '<div class="form-group">';
    html += '<label for="s1">省份 <span class="required">*</span></label>';
    html += '<input type="text" id="s1" name="s1" required placeholder="如：北京市">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label for="s2">城市 <span class="required">*</span></label>';
    html += '<input type="text" id="s2" name="s2" required placeholder="如：海淀区">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label for="s3">单位 <span class="required">*</span></label>';
    html += '<input type="text" id="s3" name="s3" required placeholder="公司/机构全称">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label for="s4">职务</label>';
    html += '<input type="text" id="s4" name="s4" placeholder="您的职务">';
    html += '</div>';

    html += '</fieldset>';

    // 议题选择
    html += '<fieldset class="form-fieldset"><legend>议题选择</legend>';

    html += '<div class="form-group">';
    html += '<label>第2天议题 <span class="required">*</span></label>';
    html += '<div class="radio-group">';
    html += '<label class="radio-label"><input type="radio" name="r1" value="AI助力企业数字化营销" required> AI助力企业数字化营销</label>';
    html += '<label class="radio-label"><input type="radio" name="r1" value="AI与生产制造计划排程"> AI与生产制造计划排程</label>';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>第3天议题 <span class="required">*</span></label>';
    html += '<div class="radio-group">';
    html += '<label class="radio-label"><input type="radio" name="r2" value="AI Agent落地最佳实践" required> AI Agent落地最佳实践</label>';
    html += '<label class="radio-label"><input type="radio" name="r2" value="AI的持续发展路径探讨"> AI的持续发展路径探讨</label>';
    html += '</div>';
    html += '</div>';

    html += '</fieldset>';

    // 开票信息
    html += '<fieldset class="form-fieldset"><legend>开票信息（可选）</legend>';

    html += '<div class="form-group">';
    html += '<label for="s5">开票抬头</label>';
    html += '<input type="text" id="s5" name="s5" placeholder="公司/个人名称">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label for="s6">税号</label>';
    html += '<input type="text" id="s6" name="s6" placeholder="统一社会信用代码">';
    html += '</div>';

    html += '</fieldset>';

    // 提交按钮
    html += '<button type="submit" class="btn-submit" id="submitBtn">提交报名</button>';

    html += '</div>';
    container.innerHTML = html;
  }

  // =====================================================================
  // 渲染 — 提交中
  // =====================================================================
  function renderSubmitting(container) {
    container.innerHTML = '<div class="status-root">' +
      '<div class="spinner"></div>' +
      '<p class="status-text">提交中，请稍候...</p>' +
      '</div>';
  }

  // =====================================================================
  // 渲染 — 成功
  // =====================================================================
  function renderSuccess(container, record) {
    container.innerHTML = '<div class="status-root success">' +
      '<div class="success-icon">&#10003;</div>' +
      '<h2 class="status-title">报名成功！</h2>' +
      '<p class="status-text">感谢您的报名，我们已收到您的信息。</p>' +
      '<p class="status-sub">记录编号：' + (record.id || record.no || '—') + '</p>' +
      '<button class="btn-submit" onclick="location.reload()">再次报名</button>' +
      '</div>';
  }

  // =====================================================================
  // 渲染 — 错误
  // =====================================================================
  function renderError(container, msg) {
    container.innerHTML = '<div class="status-root error">' +
      '<div class="error-icon">&#10007;</div>' +
      '<h2 class="status-title">提交失败</h2>' +
      '<p class="status-text">' + escapeHtml(msg) + '</p>' +
      '<button class="btn-submit" onclick="location.reload()">重试</button>' +
      '</div>';
  }

  // =====================================================================
  // 工具函数
  // =====================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatError(err) {
    if (!err) return '未知错误';
    if (err.apiMsg) return err.apiMsg;
    if (err.message) return err.message;
    return String(err);
  }

  // =====================================================================
  // 事件绑定
  // =====================================================================
  function bindEvents(container, shadowRoot) {
    shadowRoot.getElementById('submitBtn').addEventListener('click', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Find the shadow root: click event bubbles from shadow DOM button → host element
    var host = document.querySelector('ai-conf-registration');
    var shadow = (host && host.shadowRoot) ? host.shadowRoot : null;
    var container = shadow ? shadow.querySelector('.form-root') : null;
    if (!container) return;

    // Build query function scoped to shadow DOM
    function query(sel) {
      return shadow ? shadow.querySelector(sel) : null;
    }

    // 收集表单数据
    var formData = {};
    var requiredFields = ['s1', 's2', 's3', 'r1', 'r2'];

    // 必填检查
    var missing = [];
    for (var i = 0; i < requiredFields.length; i++) {
      var key = requiredFields[i];
      var el = query('[name="' + key + '"]');
      if (!el) { missing.push(key); continue; }
      if (el.type === 'radio') {
        var checked = (shadow || document).querySelector('[name="' + key + '"]:checked');
        if (!checked) missing.push(key);
        else formData[key] = checked.value;
      } else {
        if (!el.value.trim()) missing.push(key);
        else formData[key] = el.value.trim();
      }
    }

    if (missing.length > 0) {
      alert('请填写必填字段：' + missing.join(', '));
      return;
    }

    // 可选字段
    var optionalFields = ['s4', 's5', 's6'];
    for (var j = 0; j < optionalFields.length; j++) {
      var optKey = optionalFields[j];
      var optEl = query('[name="' + optKey + '"]');
      if (optEl && optEl.value.trim()) {
        formData[optKey] = optEl.value.trim();
      }
    }

    // 切换到提交中状态
    currentState = 'submitting';
    renderSubmitting(container);

    try {
      var result = await submitRegistration(formData);
      currentState = 'success';
      renderSuccess(container, result);
    } catch (err) {
      currentState = 'error';
      errorMessage = formatError(err);
      renderError(container, errorMessage);
    }
  }

  // =====================================================================
  // Widget 入口
  // =====================================================================
  function createAiConfRegistrationWidget(target) {
    initClient();

    var host = document.createElement('ai-conf-registration');
    var shadow = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow DOM
    var styleEl = document.createElement('style');
    styleEl.textContent = SHADOW_STYLES;
    shadow.appendChild(styleEl);

    var container = document.createElement('div');
    shadow.appendChild(container);
    target.appendChild(host);

    renderForm(container);
    bindEvents(container, shadow);

    return host;
  }

  // =====================================================================
  // 样式（注入 Shadow DOM）
  // =====================================================================
  var SHADOW_STYLES = [
    '.form-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; }',
    '.form-title { font-size: 24px; font-weight: 600; margin: 0 0 4px; color: #1a1a1a; text-align: center; }',
    '.form-subtitle { font-size: 14px; color: #666; margin: 0 0 24px; text-align: center; }',
    '.form-fieldset { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin: 0 0 20px; }',
    '.form-fieldset legend { font-weight: 600; font-size: 14px; color: #333; padding: 0 8px; }',
    '.form-group { margin-bottom: 16px; }',
    '.form-group:last-child { margin-bottom: 0; }',
    '.form-group label { display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 6px; }',
    '.required { color: #e53e3e; }',
    'input[type="text"] { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 14px; box-sizing: border-box; }',
    'input[type="text"]:focus { outline: none; border-color: #3182ce; box-shadow: 0 0 0 2px rgba(49,130,206,0.15); }',
    '.radio-group { display: flex; flex-direction: column; gap: 8px; }',
    '.radio-label { display: flex; align-items: center; gap: 8px; font-weight: 400; cursor: pointer; font-size: 14px; color: #333; }',
    '.btn-submit { width: 100%; padding: 12px; background: #3182ce; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 8px; }',
    '.btn-submit:hover { background: #2b6cb0; }',
    '.btn-submit:disabled { background: #a0aec0; cursor: not-allowed; }',
    '.status-root { text-align: center; padding: 48px 24px; max-width: 400px; margin: 0 auto; }',
    '.success-icon, .error-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px; }',
    '.success-icon { background: #c6f6d5; color: #276749; }',
    '.error-icon { background: #fed7d7; color: #c53030; }',
    '.status-title { font-size: 22px; font-weight: 600; margin: 0 0 8px; color: #1a1a1a; }',
    '.status-text { font-size: 14px; color: #666; margin: 0 0 8px; }',
    '.status-sub { font-size: 12px; color: #999; margin: 8px 0 24px; }',
    '.spinner { width: 40px; height: 40px; border: 3px solid #e5e5e5; border-top-color: #3182ce; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }',
    '@keyframes spin { to { transform: rotate(360deg); } }'
  ].join('\n');

  if (typeof window !== 'undefined') {
    window.createAiConfRegistrationWidget = createAiConfRegistrationWidget;
  }
})();
