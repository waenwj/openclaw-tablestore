/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * OpenClaw Tablestore plugin entry point.
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import {
  registerListTablesTool,
  registerGetTableSchemaTool,
  registerCreateTableTool,
  registerUpdateTableTool,
} from './src/tools/table/index';

const plugin = {
  id: 'openclaw-tablestore',
  name: 'Tablestore',
  description: 'Datastorage Tablestore plugin — table management and record CRUD',
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    // Table management tools
    registerListTablesTool(api);
    registerGetTableSchemaTool(api);
    registerCreateTableTool(api);
    registerUpdateTableTool(api);
  },
};

export default plugin;
