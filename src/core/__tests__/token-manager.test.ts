/**
 * TokenManager unit tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');
const mockedPost = vi.mocked(axios.post);

const BASE_URL = 'https://www.epub360.com';

describe('TokenManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure fresh module state for module-level Maps
    const mod = await import('../token-manager');
    // Reset managers Map by calling getTokenManager with a unique key
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: { access_token: 'fresh_token', expires_in: 7200 } });
  });

  it('should fetch token on first call', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost.mockResolvedValue({
      data: { access_token: 'test_token', expires_in: 7200 },
    });

    const mgr = new TokenManager('client_id', 'client_secret');
    const token = await mgr.getToken();

    expect(token).toBe('test_token');
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it('should cache token and not refetch within valid window', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost.mockResolvedValue({
      data: { access_token: 'cached_token', expires_in: 7200 },
    });

    const mgr = new TokenManager('cid', 'csecret');

    const token1 = await mgr.getToken();
    const token2 = await mgr.getToken();

    expect(token1).toBe(token2);
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });

  it('should call POST with correct body', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost.mockResolvedValue({
      data: { access_token: 'tok', expires_in: 7200 },
    });

    const mgr = new TokenManager('my_client', 'my_secret');
    await mgr.getToken();

    expect(mockedPost).toHaveBeenCalledWith(
      `${BASE_URL}/v3/api/auth/oauth/token/`,
      expect.stringContaining('client_id=my_client'),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      }),
    );
  });

  it('should clear cache and refetch on clearCache()', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost
      .mockResolvedValueOnce({ data: { access_token: 'token1', expires_in: 7200 } })
      .mockResolvedValueOnce({ data: { access_token: 'token2', expires_in: 7200 } });

    const mgr = new TokenManager('cid', 'csecret');

    const token1 = await mgr.getToken();
    expect(token1).toBe('token1');

    mgr.clearCache();

    const token2 = await mgr.getToken();
    expect(token2).toBe('token2');
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it('should throw when refresh fails', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost.mockRejectedValue(new Error('Network error'));

    const mgr = new TokenManager('cid', 'csecret');

    // getToken() throws when refresh fails
    await expect(mgr.getToken()).rejects.toThrow('Token refresh failed');
  });

  it('should throw when API returns error field', async () => {
    const { TokenManager } = await import('../token-manager');
    TokenManager.setBaseUrl(BASE_URL);

    mockedPost.mockResolvedValue({ data: { error: 'invalid_client' } });

    const mgr = new TokenManager('cid', 'csecret');

    await expect(mgr.getToken()).rejects.toThrow('Token refresh failed');
  });
});
