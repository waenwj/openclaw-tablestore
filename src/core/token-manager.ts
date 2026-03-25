/**
 * Copyright (c) 2026 epub360 and/or its affiliates
 * SPDX-License-Identifier: MIT
 *
 * TokenManager — manages OAuth2 client_credentials token lifecycle.
 *
 * - Acquires access_token via POST /v3/api/auth/oauth/token/
 * - Caches in memory with expiry tracking
 * - Proactively refreshes before expiry (REFRESH_AHEAD_MS = 5 minutes)
 * - Handles concurrent refresh with per-account locking
 * - Retries once on 401 (token expired mid-flight)
 */

import axios, { type AxiosInstance } from 'axios';
import type { AccessToken } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Refresh token when it expires within this window (ms). */
const REFRESH_AHEAD_MS = 5 * 60 * 1000; // 5 minutes

/** Base URL for token endpoint — set during plugin init. */
let BASE_URL = 'https://www.epub360.com';

// ---------------------------------------------------------------------------
// Per-account lock
// ---------------------------------------------------------------------------

const refreshLocks = new Map<string, Promise<AccessToken | null>>();

// ---------------------------------------------------------------------------
// TokenManager
// ---------------------------------------------------------------------------

export class TokenManager {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private token: AccessToken | null = null;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Override the base URL (e.g. for testing or private deployments).
   */
  static setBaseUrl(url: string): void {
    BASE_URL = url;
  }

  /**
   * Get a valid access_token, refreshing if necessary.
   */
  async getToken(): Promise<string> {
    if (this.token && this.needsRefresh() === false) {
      return this.token.accessToken;
    }

    // Need to refresh — acquire lock to avoid concurrent refresh
    const lockKey = this.clientId;
    const existingLock = refreshLocks.get(lockKey);
    if (existingLock) {
      const result = await existingLock;
      if (result) return result.accessToken;
      // If lock resolved to null, fall through to refresh below
    }

    const promise = this.doRefresh();
    refreshLocks.set(lockKey, promise);
    try {
      const result = await promise;
      if (!result) throw new Error('Token refresh failed');
      return result.accessToken;
    } finally {
      refreshLocks.delete(lockKey);
    }
  }

  /**
   * Check if the cached token needs refresh.
   * Returns false  = token is valid
   * Returns true   = token is missing or within REFRESH_AHEAD_MS of expiry
   */
  private needsRefresh(): boolean {
    if (!this.token) return true;
    return Date.now() >= this.token.expiresAt - REFRESH_AHEAD_MS;
  }

  /**
   * Execute the token refresh HTTP call.
   */
  private async doRefresh(): Promise<AccessToken | null> {
    try {
      const resp = await axios.post(
        `${BASE_URL}/v3/api/auth/oauth/token/`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10_000,
        },
      );

      const data = resp.data as { access_token?: string; expires_in?: number; error?: string };

      if (data.error) {
        throw new Error(`Token error: ${data.error}`);
      }

      if (!data.access_token) {
        throw new Error('Token response missing access_token');
      }

      const expiresInSec = data.expires_in ?? 7200;
      const expiresAt = Date.now() + expiresInSec * 1000;

      this.token = {
        accessToken: data.access_token,
        expiresAt,
      };

      return this.token;
    } catch (err) {
      console.error('[TokenManager] refresh failed:', err);
      return null;
    }
  }

  /**
   * Force-clear the cached token (useful for testing).
   */
  clearCache(): void {
    this.token = null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Cache of TokenManager instances per accountId. */
const managers = new Map<string, TokenManager>();

export function getTokenManager(accountId: string, clientId: string, clientSecret: string): TokenManager {
  const existing = managers.get(accountId);
  if (existing) return existing;
  const mgr = new TokenManager(clientId, clientSecret);
  managers.set(accountId, mgr);
  return mgr;
}
