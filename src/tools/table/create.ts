/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * epub360_tablestore_create_table tool.
 *
 * Creates a new table with optional fields.
 * Calls: POST /v2/api/tables/
 */

import { Type } from '@sinclair/typebox';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { json, createToolContext, registerTool } from '../helpers';

const FieldInput = Type.Object({
  cid: Type.Optional(Type.String({ description: '字段 ID（可不传，自动生成）' })),
  label: Type.String({ description: '字段标签/名称' }),
  field_type: Type.Number({ description: '类型：0=整数 1=浮点 2=字符串 3=日期 4=图片 5=单选 6=多选 7=文本 8=富文本 15=文件' }),
  is_required: Type.Optional(Type.Boolean()),
  is_unique: Type.Optional(Type.Boolean()),
  is_random: Type.Optional(Type.Boolean()),
  options: Type.Optional(Type.Array(Type.String(), { description: '单选/多选时使用' })),
  defaultValue: Type.Optional(Type.String()),
  widget_type: Type.Optional(Type.String()),
  can_sort: Type.Optional(Type.Boolean()),
  can_filter: Type.Optional(Type.Boolean()),
  can_search: Type.Optional(Type.Boolean()),
});

const CreateTableParams = Type.Object({
  title: Type.Optional(Type.String({ description: '表标题（默认"未命名"）' })),
  description: Type.Optional(Type.String({ description: '表描述' })),
  fields: Type.Optional(
    Type.Array(FieldInput, {
      description:
        '字段定义数组（可选，不传则创建空表）。建议一次性传入所有字段以减少 API 调用。\n' +
        'field_type: 0=整数 1=浮点 2=字符串 3=日期 4=图片 5=单选 6=多选 7=文本 8=富文本 15=文件',
    }),
  ),
  startTime: Type.Optional(Type.String({ description: '开始时间（ISO8601）' })),
  endTime: Type.Optional(Type.String({ description: '结束时间（ISO8601）' })),
  rule_type: Type.Optional(Type.Number({ description: '规则类型：1=总次数 2=日 3=周 4=月' })),
  rule_num: Type.Optional(Type.Number({ description: '规则数量' })),
  sms_check: Type.Optional(Type.Boolean({ description: '是否开启短信校验' })),
  captcha_required: Type.Optional(Type.Boolean({ description: '是否需要验证码' })),
});

const CreateTableResult = Type.Object({
  table_id: Type.Optional(Type.String()),
  uuid: Type.Optional(Type.String()),
  id: Type.Optional(Type.String()),
  title: Type.String(),
  fields: Type.Array(Type.Any()),
});

export function registerCreateTableTool(api: OpenClawPluginApi) {
  if (!api.config) return;

  const { epubClient, log } = createToolContext(api, 'epub360_tablestore_create_table');

  registerTool(
    api,
    {
      name: 'epub360_tablestore_create_table',
      label: 'Tablestore — Create Table',
      description:
        '【以用户身份】创建一个新的数据表。\n\n' +
        '创建时可传入所有字段定义（推荐），也可以先创建空表再逐个添加字段。\n' +
        'Actions: create（创建表）\n\n' +
        '⚠️ 字段定义时 field_type 必须正确：0=整数 1=浮点 2=字符串 3=日期 4=图片 5=单选 6=多选 7=文本 8=富文本 15=文件',
      parameters: CreateTableParams,
      async execute(_toolCallId, params) {
        try {
          const p = params as typeof CreateTableParams.static;

          log.info(`create_table: title=${p.title ?? '(untitled)'}, fields_count=${p.fields?.length ?? 0}`);

          const body: Record<string, unknown> = {};
          if (p.title !== undefined) body.title = p.title;
          if (p.description !== undefined) body.description = p.description;
          if (p.fields !== undefined) body.fields = p.fields;
          if (p.startTime !== undefined) body.startTime = p.startTime;
          if (p.endTime !== undefined) body.endTime = p.endTime;
          if (p.rule_type !== undefined) body.rule_type = p.rule_type;
          if (p.rule_num !== undefined) body.rule_num = p.rule_num;
          if (p.sms_check !== undefined) body.sms_check = p.sms_check;
          if (p.captcha_required !== undefined) body.captcha_required = p.captcha_required;

          const resp = await epubClient().invoke<{
            table_id?: string;
            id?: string;
            uuid?: string;
            title?: string;
            fields?: unknown[];
          }>('tablestore', 'POST', '/api/tables/', body);

          const uuid = resp.uuid ?? resp.id ?? resp.table_id;
          log.info(`create_table: created ${uuid}`);

          return json({
            table_id: resp.table_id ?? resp.id,
            uuid,
            title: resp.title ?? p.title ?? '未命名',
            fields: resp.fields ?? [],
          });
        } catch (err) {
          log.error(`create_table: failed — ${err}`);
          return json({ error: String(err) });
        }
      },
    },
    { name: 'epub360_tablestore_create_table' },
  );
}
