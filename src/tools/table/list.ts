/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * epub360_tablestore_list_tables tool.
 *
 * Lists all tables accessible to the authenticated account.
 * Calls: GET /v2/api/tables/
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { json, createToolContext, registerTool } from '../helpers';
import type { TableListResponse } from '../../core/types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ListTablesParams = Type.Object({});

const ListTablesResult = Type.Object({
  tables: Type.Array(
    Type.Object({
      uuid: Type.String({ description: 'Table UUID (唯一标识)' }),
      table_id: Type.String({ description: 'Table numeric ID' }),
      title: Type.String({ description: 'Table title' }),
      description: Type.Optional(Type.String({ description: 'Table description' })),
      fields: Type.Optional(
        Type.Array(
          Type.Object({
            cid: Type.String(),
            label: Type.String(),
            field_type: Type.Number(),
          }),
        ),
      ),
    }),
    { description: 'List of accessible tables' },
  ),
  total: Type.Optional(Type.Number({ description: 'Total count' })),
  page: Type.Optional(Type.Number()),
  size: Type.Optional(Type.Number()),
  numpages: Type.Optional(Type.Number()),
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerListTablesTool(api: OpenClawPluginApi) {
  if (!api.config) return;

  const { epubClient, log } = createToolContext(api, 'epub360_tablestore_list_tables');

  registerTool(
    api,
    {
      name: 'epub360_tablestore_list_tables',
      label: 'Tablestore — List Tables',
      description:
        '【以用户身份】列出当前账户可访问的所有数据表。返回表的基本信息（uuid、标题、描述）。\n\n' +
        '当用户要求"查看有哪些表"、"列出所有表"、或需要知道 table_id/uuid 时使用。',
      parameters: ListTablesParams,
      async execute(_toolCallId) {
        try {
          log.info('list_tables: fetching table list');

          const resp = await epubClient().invoke<TableListResponse>(
            'tablestore',
            'GET',
            '/api/tables/',
          );

          const tables = resp.data?.results ?? [];
          const meta = resp.data;
          log.info(`list_tables: returned ${tables.length} tables (total ${meta?.sum ?? 'unknown'})`);

          return json({
            tables: tables.map((t) => ({
              uuid: t.id,          // API 的 id 字段即为 UUID
              table_id: t.table_id,
              title: t.title,
              description: t.description,
              fields: t.fields,
            })),
            total: meta?.sum ?? tables.length,
            page: meta?.page,
            size: meta?.size,
            numpages: meta?.numpages,
          });
        } catch (err) {
          log.error(`list_tables: failed — ${err}`);
          return json({ error: String(err) });
        }
      },
    },
    { name: 'epub360_tablestore_list_tables' },
  );
}
