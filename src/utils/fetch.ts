import queryString from 'query-string';

export type RequestHeaders = Record<string, string>;

/**
 * 创建小程序容器可识别的普通请求头对象。
 *
 * HTYF 容器并不保证浏览器的 `Headers` 全局对象可作为构造器使用，因而请求配置
 * 必须保持为 React Native fetch 同样接受的普通键值对象。
 */
export const createRequestHeaders = (headers: RequestHeaders = {}): RequestHeaders => ({
  ...headers,
});

const findHeaderName = (headers: RequestHeaders, name: string) =>
  Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());

const hasHeader = (headers: RequestHeaders, name: string) => findHeaderName(headers, name) != null;

const isFormData = (body: unknown): body is FormData => {
  if (typeof FormData !== 'function') {
    return false;
  }
  try {
    return body instanceof FormData;
  } catch {
    return false;
  }
};

const createAbortController = (): AbortController | undefined => {
  if (typeof AbortController !== 'function') {
    return undefined;
  }
  try {
    return new AbortController();
  } catch {
    return undefined;
  }
};

/** 执行漫画源请求并保留源应用的非 2xx 响应解析语义。 */
export const fetchData = ({
  url,
  method = 'GET',
  body = {},
  headers = {},
  timeout = 10000,
}: FetchData) => {
  const controller = createAbortController();
  const requestHeaders = createRequestHeaders(headers);
  const init: RequestInit = {
    method: method.toUpperCase(),
    headers: requestHeaders,
    ...(controller ? { signal: controller.signal } : {}),
    redirect: 'follow',
    credentials: 'include',
  };

  if (Object.keys(body).length > 0) {
    if (init.method === 'GET') {
      url += '?' + queryString.stringify(body);
    }
    if (init.method === 'POST') {
      if (isFormData(body)) {
        if (!hasHeader(requestHeaders, 'Content-Type')) {
          requestHeaders['Content-Type'] = 'multipart/form-data';
        }
        init.body = body;
      } else {
        if (!hasHeader(requestHeaders, 'Content-Type')) {
          requestHeaders['Content-Type'] = 'application/json';
        }
        init.body = JSON.stringify(body);
      }
    }
  }

  const timeoutId = setTimeout(() => controller?.abort(), timeout);
  return new Promise<{ error: Error; data: undefined } | { error: undefined; data: any }>((resolve) => {
    try {
      fetch(url, init)
        .then((response) => {
          const contentType = response.headers.get('content-type') || '';
          return contentType.includes('application/json') ? response.json() : response.text();
        })
        .then((data) => resolve({ error: undefined, data }))
        .catch((error: unknown) =>
          resolve({
            error: error instanceof Error ? error : new Error('网络错误，请稍后重试'),
            data: undefined,
          })
        )
        .finally(() => clearTimeout(timeoutId));
    } catch (error) {
      clearTimeout(timeoutId);
      resolve({ error: error as Error, data: undefined });
    }
  });
};
