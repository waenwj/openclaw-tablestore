/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Shared types for the Epub360 client.
 */

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

export interface Epub360ServiceConfig {
  apiVersion: 'v2' | 'v3';
}

export interface Epub360AccountConfig {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  services?: {
    tablestore?: Epub360ServiceConfig;
    h5store?: Epub360ServiceConfig;
  };
}

export interface Epub360Config {
  baseUrl?: string;
  clientId: string;
  clientSecret: string;
  services?: {
    tablestore?: Epub360ServiceConfig;
    h5store?: Epub360ServiceConfig;
  };
  accounts?: Record<string, Epub360AccountConfig>;
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export interface AccessToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp (ms)
}

// ---------------------------------------------------------------------------
// API Response types
// ---------------------------------------------------------------------------

export interface Epub360ErrorResponse {
  code: number;
  msg: string;
}

export interface TableField {
  cid: string;
  label: string;
  field_type: number;
  is_required?: boolean;
  is_unique?: boolean;
  is_random?: boolean;
  max?: number | null;
  min?: number | null;
  config?: unknown;
  defaultValue?: string;
  can_sort?: boolean;
  can_filter?: boolean;
  can_search?: boolean;
  can_query?: boolean;
  can_calc?: boolean;
  anyone_can_edit?: boolean;
  options?: string[];
  extra_info?: Record<string, unknown>;
  widget_type?: string;
}

export interface TableListItem {
  id: string;           // UUID (唯一标识)
  table_id: string;    // 数字 ID
  app_id: string | null;
  package_status: number;
  startTime: string | null;
  endTime: string | null;
  active_auto_increment: boolean;
  sms_check: boolean;
  show_contact_info: boolean;
  show_weixin_info: boolean;
  captcha_required: boolean;
  sharing_password: string | null;
  sharing_status: number;
  title: string;
  description: string;
  created: string;
  modified: string;
  rule: number;
  application_id: string | null;
  source_id: string | null;
  sort_on: string;
  sort_order: string;
  all_total_limit: number;
  config: unknown;
  qualification_subscribe: boolean;
  fields: TableField[];
  reference_relations: string[];
  rule_type: number;
  rule_num: number;
}

export interface TableListData {
  sum: number;
  page: number;
  size: number;
  numpages: number;
  results: TableListItem[];
}

export interface TableListResponse {
  msg: string;
  code: number;
  data: TableListData;
}
