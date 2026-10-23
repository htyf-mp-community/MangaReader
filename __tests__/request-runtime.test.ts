jest.mock('query-string', () => ({
  __esModule: true,
  default: {
    parseUrl: (value: string) => ({ url: value }),
    stringify: () => '',
  },
}));
jest.mock('@/utils', () => ({
  clearAllCookie: jest.fn(),
  ErrorMessage: { CloudflareFail: 'Cloudflare', NoSupport: 'NoSupport' },
  MangaStatus: { Unknown: 0, Serial: 1, End: 2 },
}));

import bzm from '@/plugins/bzm';
import { Options } from '@/plugins/base';
import { fetchData } from '@/utils/fetch';

describe('HTYF 小程序请求运行时兼容', () => {
  test('请求挂起且 AbortController 不可用时，超时也必须结束等待', async () => {
    jest.useFakeTimers();
    const originalAbort = (global as typeof global & { AbortController?: typeof AbortController }).AbortController;
    const originalFetch = global.fetch;
    Object.defineProperty(global, 'AbortController', { configurable: true, writable: true, value: undefined });
    global.fetch = jest.fn(() => new Promise(() => {}));
    try {
      let completed = false;
      const result = fetchData({ url: 'https://example.test', timeout: 50 }).then((value) => { completed = true; return value; });
      await jest.advanceTimersByTimeAsync(51);
      expect(completed).toBe(true);
      expect((await result).error?.message).toContain('超时');
    } finally {
      global.fetch = originalFetch;
      Object.defineProperty(global, 'AbortController', { configurable: true, writable: true, value: originalAbort });
      jest.useRealTimers();
    }
  });
  test('BZM 生成请求时不依赖可构造的 Headers 全局对象', () => {
    const originalHeaders = global.Headers;
    Object.defineProperty(global, 'Headers', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });

    try {
      expect(() =>
        bzm.prepareDiscoveryFetch(1, {
          type: Options.Default,
          region: Options.Default,
          status: Options.Default,
          filter: Options.Default,
        })
      ).not.toThrow();
    } finally {
      Object.defineProperty(global, 'Headers', {
        configurable: true,
        writable: true,
        value: originalHeaders,
      });
    }
  });

  test('公共请求在 AbortController 不可构造时仍能获取数据', async () => {
    const runtime = global as typeof global & { AbortController?: typeof AbortController };
    const originalAbortController = runtime.AbortController;
    const originalFetch = global.fetch;
    Object.defineProperty(global, 'AbortController', {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
    global.fetch = jest.fn().mockResolvedValue({
      headers: { get: () => 'application/json' },
      json: async () => ({ items: [] }),
      text: async () => '',
    });

    try {
      await expect(fetchData({ url: 'https://example.test' })).resolves.toEqual({
        error: undefined,
        data: { items: [] },
      });
    } finally {
      global.fetch = originalFetch;
      Object.defineProperty(global, 'AbortController', {
        configurable: true,
        writable: true,
        value: originalAbortController,
      });
    }
  });
});
