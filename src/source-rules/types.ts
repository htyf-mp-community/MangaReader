/** MangaReader 自有 JSON 漫画源协议版本。 */
export const MANGA_SOURCE_VERSION = 1 as const;

export type SourceEngine = 'declarative' | 'builtin';
export type SourceFormat = 'html' | 'json';

export interface SourceRequestRule {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, string | number>;
}

export interface SourceListRule {
  request: SourceRequestRule;
  format: SourceFormat;
  list: string;
  fields: Record<string, string>;
  defaults?: { status?: 'unknown' | 'serial' | 'end' };
}

export interface SourceDetailRule {
  request: SourceRequestRule;
  format: SourceFormat;
  fields: Record<string, string>;
  chapters?: { list: string; fields: Record<string, string>; reverse?: boolean };
}

export interface SourceChapterRule {
  request: SourceRequestRule;
  format: SourceFormat;
  title?: string;
  images: { list: string; value: string };
  imageHeaders?: Record<string, string>;
  /** 存在该字段且解析出 URL 时继续加载下一页。 */
  nextUrl?: string;
}

export interface MangaSourceRules {
  search?: SourceListRule;
  discovery?: SourceListRule;
  detail?: SourceDetailRule;
  chapters?: SourceListRule;
  chapter?: SourceChapterRule;
}

export interface MangaSourceManifest {
  version: typeof MANGA_SOURCE_VERSION;
  id: string;
  name: string;
  shortName: string;
  description: string;
  baseUrl: string;
  score: number;
  enabled: boolean;
  engine: SourceEngine;
  /** 复杂源使用的受控内置实现名，不执行 JSON 中的任意代码。 */
  builtin?: string;
  capabilities: Array<'search' | 'discovery' | 'detail' | 'chapters' | 'images'>;
  rules?: MangaSourceRules | Record<string, unknown>;
}

export interface ParsedRule {
  selector: string;
  attribute?: string;
  transforms: string[];
}
