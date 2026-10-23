import * as cheerio from 'cheerio';
import Base, { Plugin } from '@/plugins/base';
import { MangaStatus } from '@/utils';
import { createRequestHeaders } from '@/utils/fetch';
import { readHtmlRule, readJsonPath, readJsonRule, renderSourceTemplate, renderSourceValueTemplate, resolveSourceUrl } from './engine';
import type { MangaSourceManifest, MangaSourceRules, SourceFormat, SourceListRule, SourceRequestRule } from './types';

const unsupported = (name: string) => ({ error: new Error(`JSON 漫画源未配置 ${name} 规则`) });

const renderRecord = (value: Record<string, string | number>, variables: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderSourceValueTemplate(String(item), variables)]));

/** 把 JSON 请求声明转换成现有 Saga 可消费的 FetchData。 */
export const prepareRuleRequest = (baseUrl: string, rule: SourceRequestRule, variables: Record<string, string | number>, defaultHeaders: Record<string, string> = {}): FetchData => ({
  url: resolveSourceUrl(renderSourceTemplate(rule.url, variables), baseUrl),
  method: rule.method ?? 'GET',
  headers: createRequestHeaders({ ...defaultHeaders, ...(rule.headers ? renderRecord(rule.headers, variables) : {}) }),
  body: rule.body ? renderRecord(rule.body, variables) : {},
});

const listItems = (response: unknown, rule: SourceListRule) => {
  if (rule.format === 'json') return readJsonPath(response, rule.list);
  const $ = cheerio.load(String(response ?? ''));
  return $(rule.list).toArray();
};

const field = (item: unknown, rule: SourceListRule, name: string, baseUrl: string) => {
  const expression = rule.fields[name];
  if (!expression) return '';
  return rule.format === 'json'
    ? readJsonRule(item, expression, baseUrl)
    : readHtmlRule(item as any, expression, baseUrl);
};

const readValue = (item: unknown, format: SourceFormat, expression: string | undefined, baseUrl: string) => {
  if (!expression) return '';
  return format === 'json' ? readJsonRule(item, expression, baseUrl) : readHtmlRule(item as any, expression, baseUrl);
};

const selectValues = (response: unknown, format: SourceFormat, selector: string) => {
  if (format === 'json') return readJsonPath(response, selector);
  const $ = cheerio.load(String(response ?? ''));
  return $(selector).toArray();
};

/**
 * MangaReader JSON v1 声明式执行器。
 *
 * 首阶段执行搜索和发现；未配置的详情、目录和图片能力返回明确错误，不会回退到
 * 任意代码。随应用发布的复杂源仍由受审核 builtin 扩展保持原行为。
 */
export default class DeclarativeSource extends Base {
  private readonly rules: MangaSourceRules;

  constructor(readonly manifest: MangaSourceManifest, defaultHeaders: Record<string, string> = {}) {
    super({
      id: manifest.id as Plugin,
      name: manifest.name,
      shortName: manifest.shortName,
      description: manifest.description,
      score: manifest.score,
      href: manifest.baseUrl,
      disabled: !manifest.enabled,
      defaultHeaders,
    });
    this.rules = manifest.rules as MangaSourceRules;
  }

  private assertUsableResponse(response: unknown) {
    if (typeof response !== 'string') return;
    const title = cheerio.load(response)('title').first().text().trim();
    if (title === 'Just a moment...') throw new Error(`Cloudflare 验证失败 - ${this.name}`);
  }

  private prepareList(kind: 'search' | 'discovery', variables: Record<string, string | number>) {
    const rule = this.rules[kind];
    if (!rule) throw new Error(`JSON 漫画源未配置 ${kind} 规则`);
    return prepareRuleRequest(this.href, rule.request, variables, this.defaultHeaders);
  }

  private handleList(kind: 'search' | 'discovery', response: unknown) {
    this.assertUsableResponse(response);
    const rule = this.rules[kind];
    if (!rule) return unsupported(kind);
    const values = listItems(response, rule).map((item) => {
      const mangaId = field(item, rule, 'mangaId', this.href) || field(item, rule, 'href', this.href);
      const href = resolveSourceUrl(field(item, rule, 'href', this.href) || mangaId, this.href);
      return {
        href,
        hash: Base.combineHash(this.id, mangaId),
        source: this.id,
        sourceName: this.name,
        mangaId,
        title: field(item, rule, 'title', this.href),
        bookCover: field(item, rule, 'cover', this.href),
        author: field(item, rule, 'author', this.href).split(/[,，/]/).filter(Boolean),
        tag: field(item, rule, 'tags', this.href).split(/[,，/]/).filter(Boolean),
        status: rule.defaults?.status === 'end' ? MangaStatus.End : rule.defaults?.status === 'serial' ? MangaStatus.Serial : MangaStatus.Unknown,
      };
    }).filter((item) => item.mangaId && item.title);
    return kind === 'search' ? { search: values } : { discovery: values };
  }

  prepareSearchFetch(keyword: string, page: number, filter: Record<string, string> = {}) { return this.prepareList('search', { keyword, page, ...filter }); }
  handleSearch(response: unknown) { return this.handleList('search', response) as ReturnType<Base['handleSearch']>; }
  prepareDiscoveryFetch(page: number, filter: Record<string, string>) { return this.prepareList('discovery', { page, ...filter }); }
  handleDiscovery(response: unknown) { return this.handleList('discovery', response) as ReturnType<Base['handleDiscovery']>; }
  prepareMangaInfoFetch(mangaId: string): FetchData {
    const rule = this.rules.detail;
    if (!rule) throw new Error('JSON 漫画源未配置 detail 规则');
    return prepareRuleRequest(this.href, rule.request, { mangaId }, this.defaultHeaders);
  }

  handleMangaInfo(response: unknown, mangaId = ''): ReturnType<Base['handleMangaInfo']> {
    this.assertUsableResponse(response);
    const rule = this.rules.detail;
    if (!rule) return unsupported('detail') as ReturnType<Base['handleMangaInfo']>;
    const value = rule.format === 'json' ? response : cheerio.load(String(response ?? '')).root().get(0)!;
    const get = (name: string) => readValue(value, rule.format, rule.fields[name], this.href);
    const resolvedId = get('mangaId') || mangaId;
    let chapters = rule.chapters
      ? selectValues(response, rule.format, rule.chapters.list).map((item) => {
          const chapterId = readValue(item, rule.format, rule.chapters!.fields.chapterId, this.href);
          const href = resolveSourceUrl(readValue(item, rule.format, rule.chapters!.fields.href, this.href) || chapterId, this.href);
          return { hash: Base.combineHash(this.id, resolvedId, chapterId), mangaId: resolvedId, chapterId, href, title: readValue(item, rule.format, rule.chapters!.fields.title, this.href) };
        }).filter((item) => item.chapterId && item.title)
      : [];
    if (rule.chapters?.reverse) chapters = chapters.reverse();
    return { manga: {
      href: resolveSourceUrl(get('href') || resolvedId, this.href),
      hash: Base.combineHash(this.id, resolvedId), source: this.id, sourceName: this.name,
      mangaId: resolvedId, title: get('title'), bookCover: get('cover'), infoCover: get('cover'),
      latest: get('latest'), updateTime: get('updateTime'),
      author: get('author').split(/[,，/]/).filter(Boolean),
      tag: get('tags').split(/[,，/]/).filter((tag) => tag !== '连载中' && tag !== '已完结'),
      status: get('tags').includes('连载中') ? MangaStatus.Serial : get('tags').includes('已完结') ? MangaStatus.End : MangaStatus.Unknown,
      chapters,
    } };
  }

  prepareChapterListFetch(mangaId: string, page: number): FetchData | undefined {
    const rule = this.rules.chapters;
    return rule ? prepareRuleRequest(this.href, rule.request, { mangaId, page }, this.defaultHeaders) : undefined;
  }

  handleChapterList(response: unknown, mangaId: string): ReturnType<Base['handleChapterList']> {
    const rule = this.rules.chapters;
    if (!rule) return { chapterList: [], canLoadMore: false };
    const chapterList = listItems(response, rule).map((item) => {
      const chapterId = field(item, rule, 'chapterId', this.href);
      return { hash: Base.combineHash(this.id, mangaId, chapterId), mangaId, chapterId, href: resolveSourceUrl(field(item, rule, 'href', this.href) || chapterId, this.href), title: field(item, rule, 'title', this.href) };
    }).filter((item) => item.chapterId && item.title);
    return { chapterList, canLoadMore: false };
  }

  prepareChapterFetch(mangaId: string, chapterId: string, page: number, extra: Record<string, any> = {}): FetchData {
    const rule = this.rules.chapter;
    if (!rule) throw new Error('JSON 漫画源未配置 chapter 规则');
    if (typeof extra.nextUrl === 'string') {
      return { url: extra.nextUrl, headers: createRequestHeaders({ ...this.defaultHeaders, ...(rule.request.headers ?? {}) }) };
    }
    return prepareRuleRequest(this.href, rule.request, { mangaId, chapterId, page }, this.defaultHeaders);
  }

  handleChapter(response: unknown, mangaId: string, chapterId: string, page = 1): ReturnType<Base['handleChapter']> {
    this.assertUsableResponse(response);
    const rule = this.rules.chapter;
    if (!rule) return unsupported('chapter') as ReturnType<Base['handleChapter']>;
    // 章节站点可能与漫画详情站点不同；相对图片和分页链接必须基于章节请求。
    const chapterUrl = prepareRuleRequest(this.href, rule.request, { mangaId, chapterId, page }).url;
    const images = selectValues(response, rule.format, rule.images.list)
      .map((item) => ({ uri: readValue(item, rule.format, rule.images.value, chapterUrl) }))
      .filter((item) => item.uri);
    const title = rule.title ? readValue(response, rule.format, rule.title, this.href) : '';
    const nextUrl = rule.nextUrl ? readValue(response, rule.format, rule.nextUrl, chapterUrl) : '';
    return { canLoadMore: Boolean(nextUrl), nextPage: page + 1, nextExtra: nextUrl ? { nextUrl } : {}, chapter: { hash: Base.combineHash(this.id, mangaId, chapterId), mangaId, chapterId, title, headers: { ...this.defaultHeaders, ...rule.imageHeaders }, images } };
  }
}
