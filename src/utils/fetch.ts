import queryString from 'query-string';
import { Alert } from 'react-native';
import axios from 'axios';
export const fetchData = ({
  url,
  method = 'GET',
  body = {},
  headers = new Headers(),
  timeout = 10000,
}: FetchData) => {
  const controller = new AbortController();

  // 将 Headers 对象转换为普通对象
  const axiosHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    axiosHeaders[key] = value;
  });

  // 构建 axios 配置
  const axiosConfig: any = {
    method: method.toUpperCase(),
    url,
    headers: axiosHeaders,
    timeout,
    signal: controller.signal,
    withCredentials: true,
    maxRedirects: 5,
  };

  // 处理请求体
  if (Object.keys(body)?.length > 0) {
    if (method.toUpperCase() === 'GET') {
      axiosConfig.params = body;
    } else if (method.toUpperCase() === 'POST') {
      if (body instanceof FormData) {
        axiosConfig.data = body;
        if (!axiosHeaders['Content-Type']) {
          axiosHeaders['Content-Type'] = 'multipart/form-data';
        }
      } else {
        axiosConfig.data = body;
        if (!axiosHeaders['Content-Type']) {
          axiosHeaders['Content-Type'] = 'application/json';
        }
      }
    }
  }

  const delay = setTimeout(() => {
    controller.abort();
  }, timeout);

  return new Promise<{ error: Error; data: undefined } | { error: undefined; data: any }>((res) => {
    try {
      axios(axiosConfig)
        .then((response) => {
          const contentType = response.headers['content-type'] || '';
          let data = response.data;
          
          // axios 默认会根据 content-type 自动解析 JSON
          // 如果不是 JSON，需要确保返回字符串格式
          if (!contentType.includes('application/json')) {
            // 如果 data 不是字符串，转换为字符串
            if (typeof data !== 'string') {
              data = String(data);
            }
          }
          
          res({ error: undefined, data });
        })
        .catch((error) => {
          console.error('error', error);
          res({ error: new Error('网络错误，请稍后重试'), data: undefined });
        })
        .finally(() => {
          clearTimeout(delay);
        });
    } catch (error) {
      clearTimeout(delay);
      res({ error: error as Error, data: undefined });
    }
  });
};
