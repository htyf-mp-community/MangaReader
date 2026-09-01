import queryString from 'query-string';

/** 执行漫画源请求并保留源应用的非 2xx 响应解析语义。 */
export const fetchData = ({
  url,
  method = 'GET',
  body = {},
  headers = new Headers(),
  timeout = 10000,
}: FetchData) => {
  const controller = new AbortController();
  const init: RequestInit & { headers: Headers } = {
    method: method.toUpperCase(),
    headers,
    signal: controller.signal,
    redirect: 'follow',
    credentials: 'include',
  };

  if (Object.keys(body).length > 0) {
    if (init.method === 'GET') {
      url += '?' + queryString.stringify(body);
    }
    if (init.method === 'POST') {
      if (body instanceof FormData) {
        if (!init.headers.has('Content-Type')) {
          init.headers.set('Content-Type', 'multipart/form-data');
        }
        init.body = body;
      } else {
        if (!init.headers.has('Content-Type')) {
          init.headers.set('Content-Type', 'application/json');
        }
        init.body = JSON.stringify(body);
      }
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);
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
