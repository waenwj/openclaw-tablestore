---
name: epub360-tablestore
description: |
  Epub360 Tablestore 数据表管理工具。提供数据表的增删改查和行级数据 CRUD。

  **当以下情况时使用此 Skill（管理员操作）：**
  (1) 需要查看、创建、修改、删除数据表（表结构管理）
  (2) 需要以管理员身份对记录进行增删改查
  (3) 用户提到"数据表"、"Tablestore"、"表"的管理

  **匿名用户操作（HTML 页面）** → 使用 `epub360-develop-tablestore-html` Skill

# Epub360 Tablestore SKILL

## Base URL 配置

| 端点 | Base URL |
|------|---------|
| Token (POST /v3/api/auth/oauth/token/) | https://www.epub360.com |
| Table API (GET/PATCH/POST /v2/api/tables/) | https://www.epub360.com |

**注意**：必须配置 `EPUB360_BASE_URL=https://www.epub360.com`，错误域名（如 coolsite360.com）返回 404。

## 🚨 执行前必读

- **查看表结构**：先调用 `epub360_tablestore_list_tables` 了解有哪些表及其 uuid
- **写记录前**：查看表有哪些字段（cid、类型），按正确格式构造值
- **字段 cid 格式**：Datastorage 使用类型前缀+序号命名字段
  - `iN` — 整数（integer，field_type: 0）
  - `fN` — 浮点数（float，field_type: 1）
  - `sN` — 字符串（string，field_type: 2）
  - `dN` — 日期（date，field_type: 3）
  - `gN` — 图片（image，field_type: 4）
  - `cN` — 单选（choice，field_type: 5）
  - `mN` — 多选（multiple choice，field_type: 6）
  - `tN` — 文本（text，field_type: 7）
  - `rN` — 富文本（richtext，field_type: 8）
  - `wN` — 子表（sub-table，field_type: 9，暂不支持）
  - `pN` — 评分（rating，field_type: 10）
  - `hN` — 手机（phone，field_type: 11）
  - `eN` — 邮箱（email，field_type: 12）
  - `aN` — 地址（address，field_type: 13）
  - `xN` — 开关（switch，field_type: 14）
  - `uN` — 文件（file，field_type: 15）
- **批量上限**：单次 ≤ 500 条记录
- **日期格式**：`YYYY-MM-DD` 或 `YYYY-MM-DD HH:MM:SS`

---

## 📋 快速索引：意图 → 工具 → 必填参数

| 用户意图 | 工具 | 必填参数 |
|---------|------|---------|
| 列出所有表 | epub360_tablestore_list_tables | 无 |
| 获取表结构详情 | epub360_tablestore_get_table_schema | table_uuid |
| 创建新表 | epub360_tablestore_create_table | table（name + fields） |
| 更新表（元信息/字段） | epub360_tablestore_update_table | table_uuid |

**匿名用户操作（HTML 页面）** → 参考 `epub360-develop-tablestore-html` Skill

---

## 🔍 字段类型完整映射表（field_type 0-15）

| field_type | 含义 | cid前缀 | HTML控件 | 值格式 |
|-----------|------|--------|---------|--------|
| 0 | 整数 | iN | `<input type="number">` | `100` |
| 1 | 浮点数 | fN | `<input type="number" step="0.01">` | `99.99` |
| 2 | 字符串 | sN | `<input type="text">` | `"hello"` |
| 3 | 日期 | dN | `<input type="date">` | `"2026-03-20"` |
| 4 | 图片 | gN | `<input type="file" accept="image/*">` | URL字符串 |
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
| 15 | 文件 | uN | `<input type="file">` | URL字符串 |

---

## 📌 核心工具 Response 示例

### epub360_tablestore_list_tables

调用：`GET /v2/api/tables/`

**实际 Response 示例**：
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
        "description": "员工基本信息",
        "fields": [
          { "cid": "s1", "label": "部门", "field_type": 2, "is_required": true },
          { "cid": "p1", "label": "照片", "field_type": 4 }
        ]
      }
    ]
  }
}
```

**注意**：
- UUID 字段是 `id`，不是 `uuid`
- 完整字段数组直接嵌入在 `data.results[].fields`
- `table_id` 是数字 ID，`id` 是 UUID（用于 API 调用）

---

### epub360_tablestore_get_table_schema

调用：`OPTIONS /v2/api/tables/{uuid}/`

**实际 Response 示例**：
```json
{
  "msg": "success",
  "code": 200,
  "data": {
    "id": "2c879e5ae3bb4700bf023295177d467e",
    "table_id": "167650",
    "title": "员工信息登记",
    "description": "员工基本信息",
    "fields": [
      {
        "cid": "s1",
        "label": "部门",
        "field_type": 2,
        "is_required": true,
        "is_unique": false,
        "is_random": false,
        "can_sort": true,
        "can_filter": true,
        "can_search": true,
        "can_query": true,
        "can_calc": false,
        "anyone_can_edit": false,
        "extra_info": {},
        "defaultValue": "",
        "options": [],
        "widget_type": "text",
        "max": null,
        "min": null,
        "config": {}
      }
    ],
    "config": {}
  }
}
```

### ⚠️ OPTIONS vs GET 行为差异

- `OPTIONS /v2/api/tables/{uuid}/` 返回表结构，但有时 `fields` 数组为空
- **推荐**：优先从 `GET /v2/api/tables/` 的 `results[].fields` 获取字段信息
- `GET /v2/api/tables/` 同时返回"有哪些表"和"每个表的完整字段"

---

## 🔧 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| `401` 认证失败 | client_id/client_secret 错误或 token 过期 | 检查 EPUB360_CLIENT_ID/SECRET 配置 |
| `404` 表不存在 | table_uuid 错误 或 Base URL 错误 | 确认 `EPUB360_BASE_URL=https://www.epub360.com` |
| `400` 参数错误 | 字段值格式与 cid 类型不匹配 | 按字段类型表检查字段值格式 |
| `POST /v3/api/auth/oauth/token/` 返回 400 | 请求体格式错误 | 确认使用 `Content-Type: application/json`，Body 为 JSON 对象 |
| 记录创建成功但查不到 | 表有提交规则限制 | 检查表是否需要验证码/短信校验 |
| OPTIONS 返回 0 fields | OPTIONS 端点行为不稳定 | 改用 list_tables 的内嵌 fields |

---

## ✅ 验证方法

### 环境变量
```bash
export EPUB360_CLIENT_ID=你的client_id
export EPUB360_CLIENT_SECRET=你的client_secret
export EPUB360_BASE_URL=https://www.epub360.com
```

### curl 测试完整链路
```bash
# 1. 获取 token
TOKEN=$(curl -s -X POST "https://www.epub360.com/v3/api/auth/oauth/token/" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'$EPUB360_CLIENT_ID'","client_secret":"'$EPUB360_CLIENT_SECRET'","grant_type":"client_credentials"}' \
  | jq -r '.access_token')

# 2. 列出所有表
curl -s "https://www.epub360.com/v2/api/tables/" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.results[:2]'

# 3. 获取表结构（用 list 结果中的 id 作为 table_uuid）
TABLE_UUID=$(curl -s "https://www.epub360.com/v2/api/tables/" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.results[0].id')
curl -s "https://www.epub360.com/v2/api/tables/$TABLE_UUID/" \
  -X OPTIONS -H "Authorization: Bearer $TOKEN" | jq '.data.fields[:3]'
```

### 使用 verify.ts
```bash
EPUB360_CLIENT_ID=xxx EPUB360_CLIENT_SECRET=xxx npx tsx verify.ts
```
