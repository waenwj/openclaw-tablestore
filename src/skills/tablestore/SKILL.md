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

## 🚨 执行前必读

- **查看表结构**：先调用 `epub360_tablestore_list_tables` 了解有哪些表及其 uuid
- **写记录前**：查看表有哪些字段（cid、类型），按正确格式构造值
- **字段 cid 格式**：Datastorage 使用类型前缀+序号命名字段
  - `i1` / `i2` — 整数（integer）
  - `f1` / `f2` — 浮点数（float）
  - `s1` / `s2` — 字符串（string）
  - `d1` / `d2` — 日期时间（datetime，格式 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:MM:SS`）
  - `t1` — 文本（text）
  - `r1` — 富文本（richtext）
  - `g1` — 图片（image）
  - `c1` — 单选（choice）
  - `m1` — 多选（multiple choice）
- **批量上限**：单次 ≤ 500 条记录
- **日期格式**：毫秒时间戳 或 `%Y-%m-%d %H:%M:%S` 或 ISO8601

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

## 🔍 字段类型与值格式

| cid 前缀 | 类型 | 值格式 | 示例 |
|---------|------|--------|------|
| `iN` | 整数 | number | `100` |
| `fN` | 浮点数 | number | `99.99` |
| `sN` | 字符串 | string | `"hello"` |
| `dN` | 日期时间 | string（YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS） | `"2026-03-20"` |
| `tN` | 文本 | string | `"长文本内容"` |
| `rN` | 富文本 | string | `"<p>HTML 富文本</p>"` |
| `gN` | 图片 | string（URL 或 file_token） | `"https://..."` |
| `cN` | 单选 | string | `"选项1"` |
| `mN` | 多选 | string[] | `["选项1", "选项2"]` |

**注意**：字段名使用 cid（如 `i1`）而非字段标签（如"数量"）。

---

## 📌 核心使用场景

### 场景 1: 列出所有数据表

```json
{
  "action": "list_tables"
}
```

**返回**：
```json
{
  "tables": [
    {
      "uuid": "abc123",
      "id": "1",
      "title": "客户信息表",
      "description": "存储客户基本信息和联系方式"
    }
  ],
  "total": 1
}
```

### 场景 2: 查看表结构（有哪些字段）

```json
{
  "action": "get_table_schema",
  "table_uuid": "abc123"
}
```

**返回**：包含每个字段的 `cid`、`label`、`field_type`

---

## 🔧 常见错误与排查

| 错误现象 | 根本原因 | 解决方案 |
|---------|---------|---------|
| `401` 认证失败 | client_id/client_secret 错误或 token 过期 | 检查配置或重试 |
| `404` 表不存在 | table_uuid 错误 | 先调用 list_tables 确认 uuid |
| `400` 参数错误 | 字段值格式与 cid 类型不匹配 | 按上表检查字段值格式 |
| 记录创建成功但查不到 | 表有提交规则限制 | 检查表是否需要验证码/短信校验 |
