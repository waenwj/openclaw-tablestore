# SKILL 改进建议

## 核心问题

SKILL 文档是"猜测式"的，而不是"验证式"的。
真实 API 的响应结构、字段、边界情况都需要通过试错才发现。

---

## 改进一：SKILL 应该内嵌真实 Response 示例

### 当前问题

`epub360_tablestore_list_tables` 的 SKILL 描述：

```
返回表的基本信息（uuid、标题、描述）
```

实际返回：

```json
{
  "msg": "success",
  "code": 200,
  "data": {
    "sum": 352,
    "page": 1,
    "size": 30,
    "numpages": 12,
    "results": [
      {
        "id": "2c879e5ae3bb4700bf023295177d467e",
        "table_id": "167650",
        "title": "员工信息登记",
        "fields": [
          { "cid": "s1", "label": "部门", "field_type": 2, ... },
          { "cid": "p1", "label": "照片", "field_type": 4, ... }
        ]
      }
    ]
  }
}
```

### 建议

每个工具的 SKILL 描述中，增加 **"实际 Response 示例"** 小节：

```markdown
### Response 示例
GET /v2/api/tables/ 返回：

```json
{
  "msg": "success",
  "code": 200,
  "data": {
    "sum": 352,
    "page": 1,
    "size": 30,
    "numpages": 12,
    "results": [
      {
        "id": "<UUID>",
        "table_id": "<数字ID>",
        "title": "表名",
        "fields": [{ "cid": "s1", "label": "...", "field_type": 0-15 }]
      }
    ]
  }
}
```

注意：UUID 字段是 `id`，不是 `uuid`。
```

---

## 改进二：API 请求格式必须明确

### 当前问题

TokenManager 最初写成 `application/x-www-form-urlencoded`，实际应该是 `application/json`。

### 建议

每个涉及 HTTP 的操作，都要写清楚：

```markdown
### 请求格式
POST /v3/api/auth/oauth/token/

Headers:
  Content-Type: application/json

Body (JSON):
{
  "client_id": "xxx",
  "client_secret": "xxx",
  "grant_type": "client_credentials"
}

Response:
{ "access_token": "xxx", "expires_in": 7200 }
```

---

## 改进三：每个 Skill 必须有 **验证步骤**

### 当前问题

工具写完后，没有机制验证它是否真的能用。

### 建议

每个 SKILL 结尾，增加一个 **"验证"** 小节：

```markdown
### 验证方法

1. 设置环境变量：
   export EPUB360_CLIENT_ID=xxx
   export EPUB360_CLIENT_SECRET=xxx

2. 运行集成测试：
   npm run verify

3. curl 测试：
   # 获取 token
   TOKEN=$(curl -s -X POST "https://www.epub360.com/v3/api/auth/oauth/token/" \
     -H "Content-Type: application/json" \
     -d '{"client_id":"xxx","client_secret":"xxx","grant_type":"client_credentials"}' \
     | jq -r '.access_token')

   # 验证 list 接口
   curl -s "https://www.epub360.com/v2/api/tables/" \
     -H "Authorization: Bearer $TOKEN"
```

---

## 改进四：明确 Base URL 配置

### 当前问题

Token 端点和 Table API 可能在不同域名，导致 404。

### 建议

```markdown
### Base URL 说明

| 端点 | Base URL |
|------|---------|
| Token (POST /v3/api/auth/oauth/token/) | https://www.epub360.com |
| Table API (GET/PATCH/POST /v2/api/tables/) | https://www.epub360.com |
| H5Store API (GET /v3/api/...) | https://www.epub360.com |

如果部署在其他域名，需要在 config 中单独配置 tokenBaseUrl 和 apiBaseUrl。
```

---

## 改进五：字段类型映射表应该完整

### 当前问题

SKILL 中只列举了部分 field_type，实际有 0-15：

| field_type | 含义 | HTML 控件 |
|-----------|------|----------|
| 0 | 整数 | `<input type="number">` |
| 1 | 浮点数 | `<input type="number" step="0.01">` |
| 2 | 字符串 | `<input type="text">` |
| 3 | 日期 | `<input type="date">` |
| 4 | 图片 | `<input type="file" accept="image/*">` |
| 5 | 单选 | `<input type="radio">` + options |
| 6 | 多选 | `<input type="checkbox">` + options |
| 7 | 文本 | `<textarea>` |
| 8 | 富文本 | `<textarea>` (需配合富文本编辑器) |
| 9 | 子表 | 暂不支持 |
| 10 | 评分 | `<input type="number" min="1" max="5">` |
| 11 | 手机 | `<input type="tel">` |
| 12 | 邮箱 | `<input type="email">` |
| 13 | 地址 | `<input type="text">` |
| 14 | 开关 | `<input type="checkbox">` |
| 15 | 文件 | `<input type="file">` |

---

## 改进六：Shadow DOM 陷阱必须明确标注

### 当前问题

Demo widget 第一次写的时候，style 注入到外层 document.head，表单却在 Shadow DOM 里，导致样式不生效。

### 建议

SKILL 中增加 **"常见错误"** 小节：

```markdown
### ⚠️ 常见错误

**Shadow DOM 样式**：如果使用 Shadow DOM，样式必须注入到 shadowRoot：

```javascript
// ✅ 正确
var style = document.createElement('style');
style.textContent = '...';
shadowRoot.appendChild(style);

// ❌ 错误 — 样式在外层 document，表单位于 Shadow DOM，不生效
document.head.appendChild(style);
```

**表单查询**：表单在 Shadow DOM 里时，查询元素必须用 shadowRoot：

```javascript
// ✅ 正确
shadowRoot.querySelector('#submitBtn');

// ❌ 错误 — 外层 document 查不到 Shadow DOM 里的元素
document.getElementById('submitBtn');
```
```

---

## 改进七：OPTIONS 端点的特殊行为

### 当前问题

`GET /v2/api/tables/` 返回的 `results[].fields` 是完整的，
但 `OPTIONS /v2/api/tables/{uuid}/` 返回的 fields 经常为空数组。

### 建议

SKILL 中明确这一点：

```markdown
### OPTIONS vs GET 行为差异

OPTIONS /v2/api/tables/{uuid}/
- 返回表结构（fields），但有时 fields 数组为空
- 推荐：优先从 GET /v2/api/tables/ 的 results[].fields 获取字段信息

GET /v2/api/tables/
- 返回所有表的列表，每个表内嵌完整的 fields 数组
- 推荐：用这个接口同时获取"有哪些表"和"每个表的字段"
```

---

## 改进八：verify.ts 应该成为项目标配

### 当前问题

每次验证都要手动 curl，没有自动化。

### 建议

`verify.ts` 整合到项目中，作为标准验证工具：

```bash
# 验证完整 OAuth + API 链路
EPUB360_CLIENT_ID=xxx EPUB360_CLIENT_SECRET=xxx npx tsx verify.ts

# 验证特定表
EPUB360_CLIENT_ID=xxx EPUB360_CLIENT_SECRET=xxx EPUB360_TABLE_UUID=xxx npx tsx verify.ts
```

---

## 总结：SKILL 应该回答的问题

一个好的 SKILL 应该在工具描述中直接回答：

1. **这个工具调用什么 API？** — 完整 URL + Method
2. **请求格式是什么？** — Headers + Body 示例
3. **实际返回什么？** — 完整 JSON Response 示例（含 envelope）
4. **常见错误有哪些？** — HTTP 状态码 + 错误信息
5. **如何验证？** — curl 命令 / verify.ts
6. **字段类型映射** — 完整表格
