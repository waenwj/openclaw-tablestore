/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * Epub360Client — unified HTTP client for Epub360 API calls.
 *
 * Wraps axios with:
 * - Bearer token injection (from TokenManager)
 * - Automatic retry on 401 (refresh + retry once)
 * - Per-service API version routing
 * - Unified error abstraction
 */

import axios, { type AxiosResponse, type AxiosInstance } from 'axios';
import { TokenManager } from './token-manager';
import type { Epub360ErrorResponse } from './types';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class Epub360Error extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly statusCode: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'Epub360Error';
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ServiceConfig {
  apiVersion: 'v2' | 'v3';
}

export interface Epub360ClientConfig {
  baseUrl: string;
  tokenManager: TokenManager;
  services: {
    tablestore?: ServiceConfig;
    h5store?: ServiceConfig;
  };
}

// ---------------------------------------------------------------------------
// Epub360Client
// ---------------------------------------------------------------------------

export class Epub360Client {
  private readonly baseUrl: string;
  private readonly tokenManager: TokenManager;
  private readonly http: AxiosInstance;
  private readonly services: Epub360ClientConfig['services'];

  constructor(config: Epub360ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.tokenManager = config.tokenManager;
    this.services = config.services;

    this.http = axios.create({ timeout: 30_000 });
  }

  /**
   * Get a valid access token (exposes TokenManager.getToken for verification scripts).
   */
  async getToken(): Promise<string> {
    return this.tokenManager.getToken();
  }

  /**
   * Invoke an API call on behalf of the given account.
   *
   * @param service   - 'tablestore' or 'h5store'
   * @param method    - HTTP method
   * @param path      - API path (e.g. '/api/tables/')
   * @param body      - Request body (optional)
   * @param query     - Query params (optional)
   */
  async invoke<T>(
    service: 'tablestore' | 'h5store',
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS',
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    const apiVersion = this.services[service]?.apiVersion ?? 'v3';
    const url = `${this.baseUrl}/${apiVersion}${path}`;

    // Get a valid token (may trigger refresh)
    const token = await this.tokenManager.getToken();

    const doRequest = async (accessToken: string) =>
      this.http.request<T>({
        method,
        url,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: body,
        params: query,
        validateStatus: () => true, // Handle all status codes manually
      });

    try {
      const resp = await doRequest(token);
      return this.handleResponse(resp, token);
    } catch (err) {
      // Only retry on 401 (Epub360Error with statusCode 401)
      if (err instanceof Epub360Error && err.statusCode === 401) {
        // Force-clear cached token and refresh
        this.tokenManager.clearCache();
        const newToken = await this.tokenManager.getToken();
        const retryResp = await doRequest(newToken);
        return this.handleResponse(retryResp, newToken);
      }
      throw err;
    }
  }

  private handleResponse<T>(resp: AxiosResponse<T>, _token: string): T {
    if (resp.status >= 200 && resp.status < 300) {
      return resp.data;
    }

    // Parse error body
    const data = resp.data as unknown;
    let code = 0;
    let msg = 'Unknown error';

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const errData = data as Epub360ErrorResponse & { error?: string };
      code = errData.code ?? resp.status;
      msg = errData.msg ?? errData.error ?? `HTTP ${resp.status}`;
    } else {
      msg = `HTTP ${resp.status}`;
    }

    // 401 = token issue, retry should have handled it — but surface it anyway
    throw new Epub360Error(msg, code, resp.status, data);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const clients = new Map<string, Epub360Client>();

export function getEpub360Client(
  accountId: string,
  config: Epub360ClientConfig,
): Epub360Client {
  const existing = clients.get(accountId);
  if (existing) return existing;
  const client = new Epub360Client(config);
  clients.set(accountId, client);
  return client;
}
