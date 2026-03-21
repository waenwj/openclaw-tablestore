/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * epub360_tablestore_get_table_schema tool.
 *
 * Gets detailed schema for a table (fields, types, options).
 * Calls: OPTIONS /v2/api/tables/{uuid}/
 *
 * Note: The OPTIONS endpoint may return empty fields for some tables.
 * If fields are empty, falls back to the list endpoint to get embedded fields.
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { json, createToolContext, registerTool } from '../helpers';
import type { TableField, TableListItem, TableListResponse } from '../../core/types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const GetTableSchemaParams = Type.Object({
  table_uuid: Type.String({ description: '表 UUID（slug）' }),
});

const FieldSchema = Type.Object({
  cid: Type.String({ description: '字段 ID（类型前缀+序号，如 i1/s2/d3）' }),
  label: Type.String({ description: '字段标签/名称' }),
  field_type: Type.Number({ description: '字段类型：0=整数 1=浮点 2=字符串 3=日期 4=图片 5=单选 6=多选 7=文本 8=富文本 15=文件' }),
  is_required: Type.Optional(Type.Boolean()),
  is_unique: Type.Optional(Type.Boolean()),
  is_random: Type.Optional(Type.Boolean()),
  options: Type.Optional(Type.Array(Type.String())),
  widget_type: Type.Optional(Type.String()),
  can_sort: Type.Optional(Type.Boolean()),
  can_filter: Type.Optional(Type.Boolean()),
  can_search: Type.Optional(Type.Boolean()),
  can_query: Type.Optional(Type.Boolean()),
  can_calc: Type.Optional(Type.Boolean()),
  anyone_can_edit: Type.Optional(Type.Boolean()),
  extra_info: Type.Optional(Type.Record(Type.String(), Type.Any())),
  defaultValue: Type.Optional(Type.String()),
});

const GetTableSchemaResult = Type.Object({
  uuid: Type.String(),
  table_id: Type.Optional(Type.String()),
  title: Type.String(),
  description: Type.Optional(Type.String()),
  fields: Type.Array(FieldSchema),
  config: Type.Optional(Type.Any()),
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerGetTableSchemaTool(api: OpenClawPluginApi) {
  if (!api.config) return;

  const { epubClient, log } = createToolContext(api, 'epub360_tablestore_get_table_schema');

  registerTool(
    api,
    {
      name: 'epub360_tablestore_get_table_schema',
      label: 'Tablestore — Get Table Schema',
      description:
        '【以用户身份】获取指定数据表的详细结构（字段定义、类型、选项等）。\n\n' +
        '当用户要求"查看表结构"、"获取字段列表"、"了解表有哪些列"时使用。\n' +
        '建议在创建记录或更新字段前先调用此接口了解字段的 cid 和类型。',
      parameters: GetTableSchemaParams,
      async execute(_toolCallId, params) {
        try {
          const { table_uuid } = params as { table_uuid: string };

          log.info(`get_table_schema: fetching schema for ${table_uuid}`);

          // Try OPTIONS endpoint first
          const resp = await epubClient().invoke<{
            msg?: string;
            code?: number;
            data?: {
              id?: string;
              table_id?: string;
              title?: string;
              description?: string;
              fields?: TableField[];
              config?: unknown;
            };
            id?: string;
            table_id?: string;
            title?: string;
            description?: string;
            fields?: TableField[];
            config?: unknown;
          }>('tablestore', 'OPTIONS', `/api/tables/${table_uuid}/`);

          // Extract fields from either top-level or nested data
          const raw = resp as Record<string, unknown>;
          const dataBlock = (raw.data ?? raw) as Record<string, unknown> | undefined;
          let fields = (dataBlock?.fields ?? raw.fields ?? []) as TableField[];
          const title = (dataBlock?.title ?? raw.title ?? '') as string;
          const tableId = (dataBlock?.table_id ?? raw.table_id ?? '') as string;

          // Fallback: if OPTIONS returns no fields, fetch from list endpoint
          if (fields.length === 0) {
            log.info(`get_table_schema: OPTIONS returned 0 fields, falling back to list endpoint`);
            const listResp = await epubClient().invoke<TableListResponse>(
              'tablestore',
              'GET',
              '/api/tables/',
            );
            const matched = listResp.data?.results?.find(
              (t: TableListItem) => t.id === table_uuid,
            );
            if (matched) {
              fields = matched.fields;
              log.info(`get_table_schema: found ${fields.length} fields from list fallback`);
            }
          }

          log.info(`get_table_schema: returned ${fields.length} fields`);

          return json({
            uuid: table_uuid,
            table_id: tableId,
            title,
            description: (dataBlock?.description ?? raw.description ?? '') as string,
            fields,
            config: dataBlock?.config ?? raw.config,
          });
        } catch (err) {
          log.error(`get_table_schema: failed — ${err}`);
          return json({ error: String(err) });
        }
      },
    },
    { name: 'epub360_tablestore_get_table_schema' },
  );
}
