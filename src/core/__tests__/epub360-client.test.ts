/**
 * Epub360Client unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { Epub360Client } from '../epub360-client';
import { TokenManager } from '../token-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock axios instance that returns predefined responses in order. */
function makeMockHttp(responses: Array<{ status: number; data: unknown }>): {
  http: AxiosInstance;
  callLog: string[];
} {
  let idx = 0;
  const callLog: string[] = [];

  const http = {
    request: vi.fn().mockImplementation(async () => {
      const r = responses[idx] ?? responses[responses.length - 1];
      callLog.push(`call${idx}: status=${r.status}`);
      idx++;
      return { status: r.status, data: r.data };
    }),
    defaults: {},
    interceptors: { request: { use: vi.fn(), eject: vi.fn() }, response: { use: vi.fn(), eject: vi.fn() } },
  } as unknown as AxiosInstance;

  return { http, callLog };
}

// ---------------------------------------------------------------------------
// TestableClient — Epub360Client with injectable http
// ---------------------------------------------------------------------------

type TokenManagerMock = {
  getToken: ReturnType<typeof vi.fn>;
  clearCache: ReturnType<typeof vi.fn>;
};

class TestableClient extends Epub360Client {
  readonly #mockHttp: AxiosInstance;

  constructor(http: AxiosInstance, tokenManager: TokenManagerMock) {
    // Pass minimal config — http will be replaced
    super({
      baseUrl: 'https://www.epub360.com',
      // @ts-expect-error TokenManager has getToken/clearCache
      tokenManager,
      services: { tablestore: { apiVersion: 'v2' }, h5store: { apiVersion: 'v3' } },
    });
    this.#mockHttp = http;
    Object.defineProperty(this, 'http', { value: http, writable: true });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Epub360Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- happy path -----

  it('should use v2 for tablestore service', async () => {
    const { http } = makeMockHttp([{ status: 200, data: { results: [] } }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await client.invoke('tablestore', 'GET', '/api/tables/');

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://www.epub360.com/v2/api/tables/',
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
  });

  it('should use v3 for h5store service', async () => {
    const { http } = makeMockHttp([{ status: 200, data: { works: [] } }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await client.invoke('h5store', 'GET', '/api/h5/works/');

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.epub360.com/v3/api/h5/works/' }),
    );
  });

  it('should pass body and query params', async () => {
    const { http } = makeMockHttp([{ status: 200, data: {} }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await client.invoke('tablestore', 'POST', '/api/tables/tbl1/objects/', { fields: { s1: 'x' } }, { page: '2' });

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        data: { fields: { s1: 'x' } },
        params: { page: '2' },
      }),
    );
  });

  it('should return typed data on 2xx', async () => {
    const data = { results: [{ uuid: 'abc', title: 'Test' }] };
    const { http } = makeMockHttp([{ status: 200, data }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    const result = await client.invoke<typeof data>('tablestore', 'GET', '/api/tables/');

    expect(result).toEqual(data);
  });

  // ----- error handling -----

  it('should throw Epub360Error on 4xx', async () => {
    const { http } = makeMockHttp([{ status: 400, data: { code: 400, msg: 'Bad request' } }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await expect(client.invoke('tablestore', 'GET', '/api/tables/')).rejects.toThrow('Bad request');
  });

  it('should throw Epub360Error with code on 5xx', async () => {
    const { http } = makeMockHttp([{ status: 500, data: { code: 500, msg: 'Server error' } }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await expect(client.invoke('tablestore', 'GET', '/api/tables/')).rejects.toMatchObject({
      code: 500,
      statusCode: 500,
    });
  });

  it('should throw HTTP status on plain string error body', async () => {
    const { http } = makeMockHttp([{ status: 502, data: 'Bad Gateway' }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };
    const client = new TestableClient(http, tm);

    await expect(client.invoke('tablestore', 'GET', '/api/tables/')).rejects.toThrow('HTTP 502');
  });

  // ----- 401 retry -----

  it('should retry once on 401 after clearing token', async () => {
    // Use vi.fn to control exact sequence
    let requestCount = 0;
    const requestMock = vi.fn().mockImplementation(async () => {
      requestCount++;
      if (requestCount === 1) {
        return { status: 401, data: { code: 401, msg: 'Unauthorized' } } as AxiosResponse;
      }
      return { status: 200, data: { results: [{ uuid: 'tbl1' }] } } as AxiosResponse;
    });

    const http = {
      request: requestMock,
      defaults: {},
      interceptors: { request: { use: vi.fn(), eject: vi.fn() }, response: { use: vi.fn(), eject: vi.fn() } },
    } as unknown as AxiosInstance;

    let getTokenCount = 0;
    const tm = {
      getToken: vi.fn().mockImplementation(async () => {
        getTokenCount++;
        return getTokenCount === 1 ? 'expired_token' : 'new_token';
      }),
      clearCache: vi.fn(),
    };
    const client = new TestableClient(http, tm);

    const result = await client.invoke('tablestore', 'GET', '/api/tables/');

    expect(tm.clearCache).toHaveBeenCalled();
    expect(result).toEqual({ results: [{ uuid: 'tbl1' }] });
    expect(http.request).toHaveBeenCalledTimes(2);
  });

  // ----- base URL -----

  it('should strip trailing slash from baseUrl', async () => {
    const { http } = makeMockHttp([{ status: 200, data: {} }]);
    const tm = { getToken: vi.fn().mockResolvedValue('tok'), clearCache: vi.fn() };

    class StrippedClient extends Epub360Client {
      constructor() {
        super({
          baseUrl: 'https://www.epub360.com/',
          tokenManager: tm as unknown as TokenManager,
          services: { tablestore: { apiVersion: 'v2' } },
        });
        Object.defineProperty(this, 'http', { value: http, writable: true });
      }
    }

    const client = new StrippedClient();
    await client.invoke('tablestore', 'GET', '/api/tables/');

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://www.epub360.com/v2/api/tables/' }),
    );
  });
});
