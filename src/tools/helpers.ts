/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Common helpers for Epub360 tools.
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import type { ClawdbotConfig } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { getTokenManager } from '../core/token-manager';
import { getEpub360Client, type Epub360ClientConfig } from '../core/epub360-client';
import type { Epub360Config } from '../core/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  details: unknown;
}

export interface ToolContext {
  epubClient: () => ReturnType<typeof getEpub360Client>;
  log: ReturnType<typeof createToolLogger>;
}

// ---------------------------------------------------------------------------
// Config resolution
// ---------------------------------------------------------------------------

function getEpubConfig(cfg: ClawdbotConfig) {
  return (cfg.channels as Record<string, unknown>)?.epub360 as Epub360Config | undefined;
}

function getDefaultAccountId(_cfg: ClawdbotConfig): string {
  return 'default';
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function createClientGetter(cfg: ClawdbotConfig, _accountIndex = 0) {
  return () => {
    const accountId = getDefaultAccountId(cfg);
    const epubCfg = getEpubConfig(cfg);

    if (!epubCfg?.clientId || !epubCfg?.clientSecret) {
      throw new Error(
        'Epub360 credentials not configured. Please set channels.epub360.clientId and channels.epub360.clientSecret in config.',
      );
    }

    const tokenManager = getTokenManager(accountId, epubCfg.clientId, epubCfg.clientSecret);

    const clientConfig: Epub360ClientConfig = {
      baseUrl: epubCfg.baseUrl ?? 'https://www.epub360.com',
      tokenManager,
      services: {
        tablestore: epubCfg.services?.tablestore ?? { apiVersion: 'v2' },
        h5store: epubCfg.services?.h5store ?? { apiVersion: 'v3' },
      },
    };

    return getEpub360Client(accountId, clientConfig);
  };
}

// ---------------------------------------------------------------------------
// Tool context
// ---------------------------------------------------------------------------

export function createToolContext(api: OpenClawPluginApi, toolName: string): ToolContext {
  if (!api.config) throw new Error('No config available');

  return {
    epubClient: createClientGetter(api.config),
    log: createToolLogger(api, toolName),
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTool(
  api: OpenClawPluginApi,
  tool: Parameters<OpenClawPluginApi['registerTool']>[0],
  _opts?: { name?: string },
): void {
  api.registerTool(tool);
}

// ---------------------------------------------------------------------------
// Return value formatting
// ---------------------------------------------------------------------------

export function json(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export function createToolLogger(api: OpenClawPluginApi, toolName: string) {
  const prefix = `${toolName}:`;
  return {
    info: (msg: string) => api.logger.info?.(`${prefix} ${msg}`),
    warn: (msg: string) => api.logger.warn?.(`${prefix} ${msg}`),
    error: (msg: string) => api.logger.error?.(`${prefix} ${msg}`),
    debug: (msg: string) => api.logger.debug?.(`${prefix} ${msg}`),
  };
}
