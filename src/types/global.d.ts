import { PayloadAction } from '@reduxjs/toolkit';
import { customTheme } from '@/utils';

type CustomTheme = typeof customTheme;

declare module 'native-base' {
  interface ICustomTheme extends CustomTheme {}
}

declare global {
  /** 兼容旧版 Cheerio TagElement 的文本节点访问约定。 */
  type LegacyCheerioElement = import('domhandler').Element & {
    children: Array<import('domhandler').ChildNode & { data?: string }>;
  };
  type GET = 'GET' | 'get';
  type POST = 'POST' | 'post';

  type ArrayFirst<T> = T extends [infer U, ...any[]] ? U : any;

  type FetchResponseAction<T = undefined> = PayloadAction<{
    error?: string;
    data?: T;
    actionId?: string;
  }>;

  type KeyValuePair = [string, string | null];

  interface FetchData {
    url: string;
    method?: GET | POST;
    body?: FormData | Record<string, any>;
    headers?: import('@/utils/fetch').RequestHeaders;
    timeout?: number;
  }

  interface OptionItem {
    label: string;
    value: string;
  }

  namespace NodeJS {
    interface ProcessEnv {
      NAME: string;
      VERSION: string;
      PUBLISH_TIME: string;
    }
  }
}
