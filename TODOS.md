# TODOS

## Milestone 1: Tablestore 表管理 — 第一个工具

### TODO 1: 项目初始化

- **What:** 初始化 `openclaw-tablestore` 项目骨架
- **Why:** 所有后续工作的前提
- **Status:** done ✅
- **Files:**
  - `package.json` — 依赖：axios, @sinclair/typebox, openclaw/plugin-sdk
  - `tsconfig.json` — TypeScript ES2022 配置
  - `openclaw.plugin.json` — 插件配置，声明 `channels.epub360` 配置 schema
  - `src/index.ts` — 插件主入口
  - `src/core/types.ts` — 共享类型定义

---

### TODO 2: TokenManager 实现

- **What:** 实现 TokenManager（token 换取 + 缓存 + 提前刷新 + 并发锁）
- **Why:** 底层 auth 基础设施，所有工具依赖它
- **Status:** done ✅
- **File:** `src/core/token-manager.ts`
- **Details:**
  - `POST /v3/api/auth/oauth/token/` 换取 token
  - 内存缓存 access_token
  - 过期前 5 分钟主动刷新（REFRESH_AHEAD_MS = 5min）
  - 401 响应时刷新 + 重试一次
  - Per-accountId 刷新锁（refreshLocks Map）

---

### TODO 3: Epub360Client 实现

- **What:** 实现 Epub360Client（HTTP 封装 + auth interceptor）
- **Why:** 统一封装 HTTP 逻辑，工具层只需定义 action
- **Status:** done ✅
- **File:** `src/core/epub360-client.ts`
- **Details:**
  - 单例 axios 实例（复用连接池）
  - Authorization: Bearer <token> 自动注入
  - `invoke(service, method, path, body, query)` 自动处理 token
  - 统一错误抽象（Epub360Error）
  - 401 自动刷新 + 重试一次

---

### TODO 4: epub360_tablestore_list_tables 工具

- **What:** 注册 `epub360_tablestore_list_tables` 工具
- **Why:** 第一个可验证里程碑，验证完整链路
- **Status:** done ✅
- **File:** `src/tools/table/list.ts`
- **Details:**
  - 调用 `GET /v2/api/tables/`
  - 参数：`{}`（无参数）
  - 返回：`{ tables: [{ uuid, id, title, description, fields }], total }`

---

### TODO 5: SKILL.md — Tablestore 篇

- **What:** 编写 `skills/tablestore/SKILL.md`
- **Why:** AI coding agent 通过此文档理解工具能力
- **Status:** done ✅
- **File:** `src/skills/tablestore/SKILL.md`
- **Details:**
  - 描述 epub360_tablestore_* 工具集
  - 每个工具的说明、参数、返回值
  - 字段 cid 格式说明（i1/s2/d3 等）
  - 常用场景示例

---

### TODO 6: 单元测试

- **What:** 为 TokenManager、Epub360Client、list_tables 工具编写 UT
- **Why:** Boil the Lake — 测试是最低成本的完整覆盖
- **Status:** done ✅
- **Files:**
  - `src/core/__tests__/token-manager.test.ts` — 6 tests
  - `src/core/__tests__/epub360-client.test.ts` — 9 tests
- **Details:**
  - TokenManager: 换取、缓存、错误处理、锁
  - Epub360Client: URL拼接、header注入、错误抽象、401重试
  - Tool: 参数校验、返回值格式

---

## Milestone 2: Tablestore 表管理工具

- [x] `epub360_tablestore_list_tables` — ✅ done
- [x] `epub360_tablestore_get_table_schema` — ✅ done (`OPTIONS /{v}/api/tables/{uuid}/`)
- [x] `epub360_tablestore_create_table` — ✅ done (`POST /{v}/api/tables/`)
- [x] `epub360_tablestore_update_table` — ✅ done (`PATCH /{v}/api/tables/{uuid}/`，支持 update_meta/add_field/update_field/delete_field)

---

## Milestone 3: Tablestore 记录 CRUD（TODO 待确认）

- [ ] `epub360_tablestore_list_records` — 列出/搜索记录
- [ ] `epub360_tablestore_create_records` — 批量创建记录
- [ ] `epub360_tablestore_update_records` — 批量更新记录
- [ ] `epub360_tablestore_delete_records` — 批量删除记录

---

## Milestone 4: H5 管理（TODO 待确认）

> H5 API 详情待补充后启动

- [ ] epub360_h5store_* 工具集
- [ ] skills/h5/SKILL.md
