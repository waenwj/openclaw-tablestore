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

export interface TableListItem {
  id: string;
  uuid: string;
  title: string;
  description?: string;
  fields?: TableField[];
}

export interface TableField {
  cid: string;
  label: string;
  field_type: number;
  is_required?: boolean;
  options?: string[];
}

export interface TableListResponse {
  count?: number;
  next?: string;
  previous?: string;
  results?: TableListItem[];
}
