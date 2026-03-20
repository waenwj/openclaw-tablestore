/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * epub360_tablestore_update_table tool.
 *
 * Updates table metadata or fields.
 * Supports 4 actions: update_meta, add_field, update_field, delete_field
 * Calls: PATCH /v2/api/tables/{uuid}/
 */

import { Type, Static } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { json, createToolContext, registerTool } from '../helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const FieldPatchInput = Type.Object({
  cid: Type.String({ description: '要修改的字段 cid（如 i1/s2）' }),
  label: Type.Optional(Type.String()),
  field_type: Type.Optional(Type.Number()),
  is_required: Type.Optional(Type.Boolean()),
  is_unique: Type.Optional(Type.Boolean()),
  options: Type.Optional(Type.Array(Type.String())),
});

const UpdateTableSchema = Type.Union([
  // update_meta
  Type.Object({
    action: Type.Literal('update_meta'),
    table_uuid: Type.String({ description: '表 UUID' }),
    title: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
  }),
  // add_field
  Type.Object({
    action: Type.Literal('add_field'),
    table_uuid: Type.String({ description: '表 UUID' }),
    field: Type.Object({
      label: Type.String({ description: '字段标签' }),
      field_type: Type.Number({ description: '字段类型：0=整数 1=浮点 2=字符串 3=日期 4=图片 5=单选 6=多选 7=文本 8=富文本 15=文件' }),
      is_required: Type.Optional(Type.Boolean()),
      options: Type.Optional(Type.Array(Type.String())),
    }),
  }),
  // update_field
  Type.Object({
    action: Type.Literal('update_field'),
    table_uuid: Type.String({ description: '表 UUID' }),
    field: FieldPatchInput,
  }),
  // delete_field
  Type.Object({
    action: Type.Literal('delete_field'),
    table_uuid: Type.String({ description: '表 UUID' }),
    field_cid: Type.String({ description: '要删除的字段 cid' }),
  }),
]);

type UpdateTableParams = Static<typeof UpdateTableSchema>;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerUpdateTableTool(api: OpenClawPluginApi) {
  if (!api.config) return;

  const { epubClient, log } = createToolContext(api, 'epub360_tablestore_update_table');

  registerTool(
    api,
    {
      name: 'epub360_tablestore_update_table',
      label: 'Tablestore — Update Table',
      description:
        '【以用户身份】更新数据表的元信息或字段。\n\n' +
        'Actions:\n' +
        '- update_meta：更新表标题、描述\n' +
        '- add_field：添加新字段\n' +
        '- update_field：修改已有字段\n' +
        '- delete_field：删除字段\n\n' +
        '⚠️ delete_field 会同时删除该字段的所有数据！',
      parameters: UpdateTableSchema,
      async execute(_toolCallId, params) {
        try {
          const p = params as UpdateTableParams;
          const { table_uuid } = p;

          log.info(`update_table: action=${p.action}, table=${table_uuid}`);

          let body: Record<string, unknown> = {};
          let path = `/api/tables/${table_uuid}/`;

          switch (p.action) {
            case 'update_meta':
              body = {};
              if (p.title !== undefined) body.title = p.title;
              if (p.description !== undefined) body.description = p.description;
              break;

            case 'add_field':
              body = { fields: [p.field] };
              break;

            case 'update_field':
              body = { fields: [p.field] };
              break;

            case 'delete_field':
              path = `/api/tables/${table_uuid}/fields/${p.field_cid}/`;
              body = {};
              // DELETE doesn't use PATCH body — just delete via HTTP DELETE
              const delResp = await epubClient().invoke<{ success?: boolean; error?: string }>(
                'tablestore',
                'DELETE',
                path,
              );
              log.info(`update_table: deleted field ${p.field_cid}`);
              return json({ success: true, action: 'delete_field', deleted_cid: p.field_cid });
          }

          const resp = await epubClient().invoke<{ title?: string; fields?: unknown[] }>(
            'tablestore',
            'PATCH',
            path,
            body,
          );

          log.info(`update_table: ${p.action} completed`);
          return json({ success: true, action: p.action, result: resp });
        } catch (err) {
          log.error(`update_table: failed — ${err}`);
          return json({ error: String(err) });
        }
      },
    },
    { name: 'epub360_tablestore_update_table' },
  );
}
