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

## 开发工作流

**重要：生成页面之前，必须先获取表结构。**

1. **先调用工具获取表结构**：
```json
{
  "action": "get_table_schema",
  "table_uuid": "<目标表的uuid>"
}
```

2. **根据返回的字段信息**（`cid`、`label`、`field_type`），生成对应的 HTML 表单或列表列

**表结构返回示例**：
```json
{
  "fields": [
    { "cid": "s1", "label": "姓名", "field_type": 2 },
    { "cid": "i2", "label": "年龄", "field_type": 0 },
    { "cid": "d3", "label": "报名日期", "field_type": 3 },
    { "cid": "r1", "label": "是否参加", "field_type": 5, "options": ["是", "否"] }
  ]
}
```

3. **根据字段类型**（`field_type`）生成对应的表单控件：
   - `field_type: 2`（string）→ 文本输入框
   - `field_type: 0`（integer）→ 数字输入框
   - `field_type: 5`（radio）→ 单选按钮组（options 为候选项）
   - `field_type: 6`（multiselect）→ 多选框组

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

## 3. 字段类型与值格式

| cid 前缀 | 类型 | 示例值 |
|---------|------|--------|
| `iN` | 整数 | `100` |
| `fN` | 浮点数 | `99.99` |
| `sN` | 字符串 | `"hello"` |
| `dN` | 日期 | `"2026-03-20"` 或 `"2026-03-20 14:30:00"` |
| `tN` | 文本 | `"长文本内容"` |
| `rN` | 富文本 | `"<p>HTML 富文本</p>"` |
| `gN` | 图片 | 图片 URL 字符串 |
| `cN` | 单选 | `"选项1"` |
| `mN` | 多选 | `["选项1", "选项2"]` |

**注意**：字段名使用 cid（如 `s1`）而非字段标签（如"姓名"）。

---

## 4. 工程模式：壳页面 + Widget 分离

参考 `docs/demo-html/registration/` 的结构：

```
my-form/
  my-form.html      ← 壳页面：加载 SDK + 挂载 widget
  my-form-widget.js ← 全部业务代码（自包含 IIFE）
```

### 4.1 HTML 壳页面（my-form.html）

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>报名表单</title>
</head>
<body>
  <div id="app"></div>

  <!-- SDK 必须先于 widget 加载 -->
  <script src="../sdk/vibe-tablestore-sdk.umd.js"></script>
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

### 4.2 Widget 代码结构（my-form-widget.js）

```javascript
(function() {
  'use strict';
  var global = typeof window !== 'undefined' ? window : globalThis;

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

  function getTable(tableId) {
    return initClient().table(tableId, { cryptoMode: 'auto' });
  }

  // ========== State 管理 ==========
  // 简单状态机：view = 'form' | 'success' | 'list'
  // ...

  // ========== API 调用 ==========
  async function createRecord(formData) {
    var table = getTable(TABLE_ID);
    var result = await table.create(formData, {
      cryptoMode: 'encrypted',
      credentials: 'include'
    });
    return result;
  }

  async function listRecords(page, size) {
    var table = getTable(TABLE_ID);
    return await table.list({ page: page, size: size });
  }

  // ========== 渲染与事件 ==========
  function renderForm() { /* ... */ }
  function renderSuccess() { /* ... */ }
  function renderList() { /* ... */ }
  function bindEvents() { /* ... */ }

  // ========== 入口函数 ==========
  function createMyFormWidget(target) {
    var host = document.createElement('my-form-root');
    var shadow = host.attachShadow({ mode: 'open' });
    var container = document.createElement('div');
    shadow.appendChild(container);
    initClient();
    // ...
    target.appendChild(host);
    return host;
  }

  if (typeof window !== 'undefined') {
    window.createMyFormWidget = createMyFormWidget;
  }
})();
```

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

**Step 3**: 按字段生成对应的 HTML 表单控件：
- `field_type: 2`（字符串）→ `<input type="text">`
- `field_type: 0`（整数）→ `<input type="number">`
- `field_type: 3`（日期）→ `<input type="date">`
- `field_type: 5`（单选）→ 渲染 `options` 数组为 radio 按钮
- `field_type: 6`（多选）→ 渲染 `options` 数组为 checkbox 组

**Step 4**: 调用 SDK 的 `table.create()` 提交表单数据

---

## 7. 典型场景示例

### 场景 1：报名表单（create）

**需求**：用户填写表单 → 点击提交 → 显示报名成功

**关键代码**：

```javascript
async function handleSubmit(formData) {
  var table = getTable(TABLE_ID);
  var result = await table.create(formData, {
    cryptoMode: 'encrypted',
    credentials: 'include'
  });
  return result;  // { id, no, raw }
}
```

**UI 状态流**：`form → submitting → success`（含回执）

### 场景 2：数据列表（list）

**需求**：展示数据列表，支持分页

**关键代码**：

```javascript
async function loadRecords(page) {
  var result = await table.list({
    page: page,
    size: 20,
    data: { sort: ['-created'] }
  });
  return result;  // { items, page, size, total }
}
```

### 场景 3：编辑记录（update）

**需求**：用户编辑已有记录并保存

**关键代码**：

```javascript
async function updateRecord(id, fields) {
  var table = getTable(TABLE_ID);
  return await table.update(id, fields, {
    cryptoMode: 'encrypted'
  });
}
```

---

## 7. 约束与注意事项

1. **API Base 必须用相对路径**（如 `/v2/api/tables/`），禁止硬编码 `https://...` 或 `localhost`
2. **不要在代码里读取 cookie 或传 token** — SDK 自动处理同源请求凭证
3. **不要把 token 写入 localStorage 或硬编码**
4. **附件上传字段**（图片/文件）不走 `encryptdata`，走 `files`（FormData）参数
5. **cryptoMode**：`encrypted` = 加密提交，`auto` = 自动识别（推荐默认用 `auto`）
6. **credentials**：`include` = 携带同源 Cookie（推荐）

---

## 8. 与 epub360_tablestore_* 工具的区别

| | 本 Skill | epub360_tablestore_* 工具 |
|---|---------|------------------------|
| 操作者 | 匿名用户（网页端） | 管理员（OpenClaw Agent） |
| 鉴权方式 | 同源 Cookie 自动携带 | OAuth2 token（client_id/secret） |
| 工具形态 | HTML + JS SDK | OpenClaw Tool（直接 API 调用） |
| 使用场景 | 用户表单提交、数据展示 | 管理员增删改查表结构 |
