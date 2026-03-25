---
name: epub360-develop-tablestore-html
description: |
  教 OpenClaw Coding Agent 如何生成包含 Tablestore JS SDK 的 HTML 页面，使匿名用户能在网页上对数据表记录进行 CRUD 操作。

  **当以下情况时使用此 Skill：**
  (1) 用户要求生成一个"报名表单"、"数据提交页面"、"记录列表页"、"编辑页面"
  (2) 用户提到"嵌入到网页"、"HTML 页面"、"JS SDK"、"匿名用户提交"
  (3) 需要开发"用户端"数据操作页面，而非管理员后台操作
---

# epub360-develop-tablestore-html SKILL

## ⚠️ Shadow DOM 陷阱（常见错误）

本 Skill 使用 **Shadow DOM** 隔离 Widget 样式和逻辑。以下是两个最常见的致命错误：

### 错误 1：样式注入到外层 document（样式不生效）

```javascript
// ❌ 错误 — 样式在外层 document，表单位于 Shadow DOM，不生效
var style = document.createElement('style');
style.textContent = '...';
document.head.appendChild(style);

// ✅ 正确 — 样式注入到 shadowRoot
var styleEl = document.createElement('style');
styleEl.textContent = SHADOW_STYLES;
shadow.appendChild(styleEl);
```

### 错误 2：表单查询作用域错误（找不到元素）

```javascript
// ❌ 错误 — 外层 document 查不到 Shadow DOM 里的元素
var input = document.getElementById('s1');
var checked = document.querySelector('[name="r1"]:checked');

// ✅ 正确 — 用 shadowRoot 查询 Shadow DOM 里的元素
var shadow = host.shadowRoot;
function query(sel) { return shadow ? shadow.querySelector(sel) : null; }
var input = query('#s1');
var checked = (shadow || document).querySelector('[name="r1"]:checked');
```

### 完整 handleSubmit 正确模式

```javascript
async function handleSubmit(e) {
  e.preventDefault();

  // 获取 Shadow DOM 引用
  var host = document.querySelector('my-form-root');
  var shadow = (host && host.shadowRoot) ? host.shadowRoot : null;
  var container = shadow ? shadow.querySelector('.form-root') : null;
  if (!container) return;

  // 查询函数必须 scoped 到 Shadow DOM
  function query(sel) { return shadow ? shadow.querySelector(sel) : null; }

  // 收集表单数据
  var formData = {};
  var s1 = query('#s1');
  if (s1 && s1.value.trim()) formData.s1 = s1.value.trim();

  // 切换状态
  currentState = 'submitting';
  renderSubmitting(container);

  try {
    var result = await submitRegistration(formData);
    currentState = 'success';
    renderSuccess(container, result);
  } catch (err) {
    currentState = 'error';
    renderError(container, formatError(err));
  }
}
```

---

## 🔍 字段类型完整映射表（field_type 0-15）

| field_type | 含义 | cid前缀 | HTML控件 | 值格式 |
|-----------|------|--------|---------|--------|
| 0 | 整数 | iN | `<input type="number">` | `100` |
| 1 | 浮点数 | fN | `<input type="number" step="0.01">` | `99.99` |
| 2 | 字符串 | sN | `<input type="text">` | `"hello"` |
| 3 | 日期 | dN | `<input type="date">` | `"2026-03-20"` |
| 4 | 图片 | gN | `<input type="file" accept="image/*">` | 文件对象 |
| 5 | 单选 | cN | `<input type="radio">` + options | `"选项1"` |
| 6 | 多选 | mN | `<input type="checkbox">` + options | `["选1","选2"]` |
| 7 | 文本 | tN | `<textarea>` | `"长文本"` |
| 8 | 富文本 | rN | `<textarea>` + 富文本编辑器 | `"<p>HTML</p>"` |
| 9 | 子表 | wN | 暂不支持 | — |
| 10 | 评分 | pN | `<input type="number" min="1" max="5">` | `5` |
| 11 | 手机 | hN | `<input type="tel">` | `"13800138000"` |
| 12 | 邮箱 | eN | `<input type="email">` | `"a@b.com"` |
| 13 | 地址 | aN | `<input type="text">` | `"北京市海淀区"` |
| 14 | 开关 | xN | `<input type="checkbox">` | `true`/`false` |
| 15 | 文件 | uN | `<input type="file">` | 文件对象 |

**注意**：附件字段（图片 field_type:4 / 文件 field_type:15）走 SDK 的 `files` 参数，不走加密 payload。

---

## 开发工作流

**重要：生成页面之前，必须先获取表结构。**

1. **先调用工具获取表结构**：
```json
{
  "action": "get_table_schema",
  "table_uuid": "<目标表的uuid>"
}
```

2. **根据返回的字段信息**（`cid`、`label`、`field_type`、`options`），生成对应的 HTML 表单或列表列

**表结构返回示例**：
```json
{
  "fields": [
    { "cid": "s1", "label": "姓名", "field_type": 2 },
    { "cid": "i2", "label": "年龄", "field_type": 0 },
    { "cid": "d3", "label": "报名日期", "field_type": 3 },
    { "cid": "c1", "label": "是否参加", "field_type": 5, "options": ["是", "否"] },
    { "cid": "m2", "label": "感兴趣的议题", "field_type": 6, "options": ["AI营销", "生产制造", "Agent"] }
  ]
}
```

3. **根据字段类型**（`field_type`）生成对应的表单控件（见上表）

---

## 何时使用此 Skill

| 用户意图 | 应生成的内容 |
|---------|-------------|
| "做一个报名表单，让用户填写" | 报名表单 HTML（create 场景） |
| "展示数据列表" | 列表页 HTML（list 场景） |
| "让用户编辑自己的信息" | 编辑页 HTML（update 场景） |
| "让用户删除记录" | 删除操作（remove 场景，常结合列表页） |
| "做一个页面，用户可以提交表单" | create 为主 |

**本 Skill 不做管理员操作**（管理员操作使用 `epub360_tablestore_*` 工具）。

---

## 快速索引

| 场景 | SDK 方法 | 说明 |
|-----|---------|------|
| 初始化 | `createTableStoreClient()` | 创建客户端 |
| 获取 table 实例 | `client.table(tableId, options)` | 每次 CRUD 前调用 |
| 列表/搜索 | `table.list({ page, size, data })` | 分页 + 筛选 |
| 详情 | `table.getById(id)` | 获取单条记录 |
| 创建 | `table.create(payload, options)` | 提交表单 |
| 更新 | `table.update(id, payload, options)` | 编辑保存 |
| 删除 | `table.remove(id)` | 删除记录 |

---

## 1. SDK 加载与初始化

### 1.1 引入 SDK

```html
<!-- 必须使用相对路径，禁止硬编码域名或 localhost -->
<script src="https://21epub-assets.zhizhucms.com/tablestore/vibe-tablestore-sdk.umd.js"></script>
```

### 1.2 初始化客户端

```javascript
var client = window.VibeTableStoreSDK.createTableStoreClient({
  defaultCryptoMode: 'auto'   // 自动识别加密/明文
});
```

### 1.3 获取 table 实例

```javascript
var table = client.table('<table_id>', {
  cryptoMode: 'auto'
});
```

---

## 2. CRUD 操作

### 2.1 列表查询（list）

```javascript
var result = await table.list({
  page: 1,       // 页码（从 1 开始）
  size: 20,      // 每页条数（默认 20，最大 500）
  data: {
    sort: ['-created'],   // 排序：-created = 按创建时间倒序
    query: {             // 可选：筛选条件
      s1: '北京'         // s1 字段等于"北京"
    }
  }
});

// 返回结构：
// {
//   items: [...],        // 记录数组
//   page: 1,
//   size: 20,
//   total: 100,          // 总条数
//   raw: {...}           // 原始响应
// }
```

### 2.2 获取单条（getById）

```javascript
var record = await table.getById('<record_id>');
// 返回记录对象，或 null（若不存在）
// 若后端返回 results[]，SDK 取 results[0]
```

### 2.3 创建记录（create）

```javascript
var result = await table.create(
  { s1: '张三', i2: 28, d3: '2026-03-20' },   // payload：业务字段，key = cid
  { cryptoMode: 'encrypted', credentials: 'include' }
);

// 返回：{ id, no?, raw }
```

### 2.4 更新记录（update）

```javascript
var result = await table.update(
  '<record_id>',                            // 记录 ID
  { s1: '李四', i2: 30 },                  // 要更新的字段
  { cryptoMode: 'encrypted' }
);

// 返回：{ id, raw }
```

### 2.5 删除记录（remove）

```javascript
await table.remove('<record_id>');
// 无返回值（成功则不抛错）
```

---

## 3. 工程模式：壳页面 + Widget 分离

参考 `docs/demo-html/ai-conf-registration/` 的结构：

```
my-form/
  my-form.html          ← 壳页面：加载 SDK + 挂载 widget
  my-form-widget.js     ← 全部业务代码（自包含 IIFE）
```

### 3.1 HTML 壳页面（my-form.html）

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>报名表单</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; }
  </style>
</head>
<body>
  <div id="app"></div>

  <!-- SDK 必须先于 widget 加载 -->
  <script src="https://21epub-assets.zhizhucms.com/tablestore/vibe-tablestore-sdk.umd.js"></script>
  <script src="./my-form-widget.js"></script>
  <script>
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
    function init() {
      window.createMyFormWidget(document.getElementById('app'));
    }
  </script>
</body>
</html>
```

### 3.2 Widget 代码结构（my-form-widget.js）

```javascript
(function() {
  'use strict';
  var global = typeof window !== 'undefined' ? window : globalThis;

  // ========== Config ==========
  var TABLE_ID = '<table_uuid>';

  // ========== SDK 初始化 ==========
  var client = null;

  function initClient() {
    if (client) return client;
    if (!window.VibeTableStoreSDK) {
      throw new Error('VibeTableStoreSDK not loaded');
    }
    client = window.VibeTableStoreSDK.createTableStoreClient({
      defaultCryptoMode: 'auto'
    });
    return client;
  }

  function getTable() {
    return initClient().table(TABLE_ID, { cryptoMode: 'auto' });
  }

  // ========== API 调用 ==========
  async function createRecord(formData) {
    var table = getTable();
    var result = await table.create(formData, {
      cryptoMode: 'encrypted',
      credentials: 'include'
    });
    return result;
  }

  // ========== Shadow DOM 样式（注入 shadowRoot） ==========
  var SHADOW_STYLES = [
    '.form-root { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; }',
    '.form-title { font-size: 24px; font-weight: 600; margin: 0 0 24px; text-align: center; }',
    '.form-group { margin-bottom: 16px; }',
    '.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }',
    'input[type="text"] { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 6px; box-sizing: border-box; }',
    '.btn-submit { width: 100%; padding: 12px; background: #3182ce; color: white; border: none; border-radius: 8px; cursor: pointer; }',
    '.status-root { text-align: center; padding: 48px 24px; }'
  ].join('\n');

  // ========== 渲染 ==========
  function renderForm(container) {
    container.innerHTML = '<div class="form-root">' +
      '<h2 class="form-title">报名表单</h2>' +
      '<div class="form-group"><label>姓名 <span style="color:#e53e3e">*</span></label>' +
      '<input type="text" id="s1" name="s1" required></div>' +
      '<button type="submit" class="btn-submit" id="submitBtn">提交</button>' +
      '</div>';
  }

  function renderSuccess(container, record) {
    container.innerHTML = '<div class="status-root success">' +
      '<h2>报名成功！</h2>' +
      '<p>记录编号：' + (record.id || record.no || '—') + '</p>' +
      '</div>';
  }

  function renderError(container, msg) {
    container.innerHTML = '<div class="status-root error">' +
      '<h2>提交失败</h2><p>' + escapeHtml(msg) + '</p>' +
      '</div>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatError(err) {
    if (!err) return '未知错误';
    if (err.apiMsg) return err.apiMsg;
    if (err.message) return err.message;
    return String(err);
  }

  // ========== 事件绑定 ==========
  function bindEvents(container, shadow) {
    shadow.getElementById('submitBtn').addEventListener('click', handleSubmit);
  }

  // ========== 提交处理（正确使用 Shadow DOM 查询） ==========
  async function handleSubmit(e) {
    e.preventDefault();

    var host = document.querySelector('my-form-root');
    var shadow = (host && host.shadowRoot) ? host.shadowRoot : null;
    var container = shadow ? shadow.querySelector('.form-root') : null;
    if (!container) return;

    function query(sel) { return shadow ? shadow.querySelector(sel) : null; }

    var s1 = query('#s1');
    if (!s1 || !s1.value.trim()) {
      alert('请填写必填字段');
      return;
    }

    var formData = { s1: s1.value.trim() };

    // 切换到提交中状态
    container.innerHTML = '<div class="status-root"><p>提交中...</p></div>';

    try {
      var result = await createRecord(formData);
      renderSuccess(container, result);
    } catch (err) {
      renderError(container, formatError(err));
    }
  }

  // ========== Widget 入口 ==========
  function createMyFormWidget(target) {
    initClient();

    var host = document.createElement('my-form-root');
    var shadow = host.attachShadow({ mode: 'open' });

    // ✅ 样式必须注入 Shadow DOM
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

  if (typeof window !== 'undefined') {
    window.createMyFormWidget = createMyFormWidget;
  }
})();
```

---

## 4. 本地开发与代理

由于浏览器同源策略限制，本地 HTML 文件无法直接调用 API。需要使用反向代理。

### Python 代理服务器（推荐）

创建 `proxy.py`：

```python
#!/usr/bin/env python3
import http.server, socketserver, urllib.request, urllib.error, os

PROXY_PREFIX = "/v2/api"
TARGET_BASE = "https://www.epub360.com"
STATIC_PORT = 8765
STATIC_ROOT = "/path/to/your/project/docs/demo-html/my-form"

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self.proxy_request("GET")
        else:
            self.serve_static()

    def do_POST(self):
        if self.path.startswith(PROXY_PREFIX):
            self.proxy_request("POST")
        else:
            self.send_error(404)

    def proxy_request(self, method):
        target_url = TARGET_BASE + self.path
        print(f"[PROXY] {method} {target_url}")
        try:
            headers = {k: v for k, v in self.headers.items() if k.lower() not in ("host", "connection")}
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else None
            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(k, v)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_error(502, str(e))

    def serve_static(self):
        root = STATIC_ROOT
        local_path = self.path.lstrip("/")
        if local_path == "" or local_path == "/":
            local_path = "index.html"
        file_path = os.path.join(root, local_path)
        if ".." in local_path:
            self.send_error(403)
            return
        if os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_type = {".html": "text/html", ".js": "application/javascript",
                            ".css": "text/css", ".json": "application/json",
                            ".png": "image/png"}.get(ext, "application/octet-stream")
            with open(file_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", len(data))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404, f"Not found: {self.path}")

    def log_message(self, fmt, *args):
        pass

class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    os.chdir(STATIC_ROOT)
    server = ReuseAddrTCPServer(("0.0.0.0", STATIC_PORT), ProxyHandler)
    print(f"Serving static from: {STATIC_ROOT}")
    print(f"Proxy /v2/api/* → {TARGET_BASE}/v2/api/*")
    print(f"Run at: http://localhost:{STATIC_PORT}/")
    server.serve_forever()
```

### 启动代理

```bash
python3 proxy.py
# 访问 http://localhost:8765/my-form.html
```

### 注意事项

- 静态文件必须放在 `STATIC_ROOT` 目录内
- 代理会自动转发 `/v2/api/*` 请求到 epub360.com
- API 返回的 CORS 头允许 localhost 访问

---

## 5. 错误处理

SDK 抛出 `TableStoreSDKError`，结构如下：

```javascript
{
  code: 'http_error' | 'api_error' | 'decrypt_failed' | 'encrypt_failed' | 'invalid_response' | 'invalid_argument',
  message: '错误消息',
  status: 400,          // HTTP 状态码（如有）
  apiCode: 400,         // 后端业务码（如有）
  apiMsg: '具体消息',   // 后端消息（如有）
  raw: { ... }          // 原始上下文
}
```

### 错误展示示例

```javascript
function formatError(error) {
  if (!error) return '未知错误';
  if (error.code || error.apiCode) {
    var parts = [];
    if (error.message) parts.push(error.message);
    if (error.apiCode) parts.push('[' + error.apiCode + ']');
    if (error.apiMsg) parts.push(error.apiMsg);
    return parts.join(' ') || '请求失败';
  }
  return error.message || String(error);
}
```

---

## 6. 典型开发工作流

### 工作流：生成报名表单页面

**Step 1**: 调用 `epub360_tablestore_get_table_schema` 获取表结构
```json
{
  "action": "get_table_schema",
  "table_uuid": "abc123"
}
```

**Step 2**: 根据返回的 `fields` 数组，识别所有字段的 cid、label、field_type、options

**Step 3**: 按字段生成对应的 HTML 表单控件（见 field_type 映射表）

**Step 4**: 调用 SDK 的 `table.create()` 提交表单数据

---

## 7. 约束与注意事项

1. **API Base 必须用相对路径**（如 `/v2/api/tables/`），禁止硬编码 `https://...` 或 `localhost`
2. **不要在代码里读取 cookie 或传 token** — SDK 自动处理同源请求凭证
3. **不要把 token 写入 localStorage 或硬编码**
4. **附件上传字段**（图片/文件）不走 `encryptdata`，走 `files`（FormData）参数
5. **cryptoMode**：`encrypted` = 加密提交，`auto` = 自动识别（推荐默认用 `auto`）
6. **credentials**：`include` = 携带同源 Cookie（推荐）
7. **Shadow DOM**：样式必须 `shadowRoot.appendChild(styleEl)`，表单查询必须 `shadowRoot.querySelector()`

---

## 8. 与 epub360_tablestore_* 工具的区别

| | 本 Skill | epub360_tablestore_* 工具 |
|---|---------|------------------------|
| 操作者 | 匿名用户（网页端） | 管理员（OpenClaw Agent） |
| 鉴权方式 | 同源 Cookie 自动携带 | OAuth2 token（client_id/secret） |
| 工具形态 | HTML + JS SDK | OpenClaw Tool（直接 API 调用） |
| 使用场景 | 用户表单提交、数据展示 | 管理员增删改查表结构 |

---

## ✅ 验证方法

### 使用 gstack browse 测试

```bash
# 启动代理后，在 headless 浏览器中测试
$B goto http://localhost:8765/my-form.html
$B snapshot -i           # 查看表单元素是否正确渲染
$B console               # 检查是否有 JS 错误
$B network               # 检查 API 请求是否成功
```

### 测试要点

1. **页面加载无崩溃** — console 无 Error 级别错误
2. **表单可见** — 能看到所有 input/radio/checkbox
3. **SDK 已加载** — `window.VibeTableStoreSDK` 存在
4. **Shadow DOM 隔离正确** — 样式生效（背景色、字体等）
5. **提交成功** — 填写表单后点击提交，显示成功状态

### 本地开发检查清单

- [ ] 代理服务器正在运行（`python3 proxy.py`）
- [ ] 访问 `http://localhost:8765/` 可看到 HTML 页面
- [ ] F12 Network 中有 `/v2/api/tables/` 的 OPTIONS 请求
- [ ] 提交表单后有 `POST /v2/api/tables/{uuid}/objects/` 请求
- [ ] 返回 200 且有 `id` 字段表示创建成功
