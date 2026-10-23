import Base from '@/plugins/base';
import DeclarativeSource from './DeclarativeSource';
import type { MangaSourceManifest, MangaSourceRules } from './types';

/**
 * 为内置源逐阶段启用 JSON 规则。只有清单中配置完整的搜索/发现阶段走声明式
 * 执行器，其余调用原实现，从而允许逐源迁移且不牺牲现有复杂能力。
 */
export default class ManifestBackedSource extends Base {
  private readonly declarative: DeclarativeSource;
  private readonly rules: MangaSourceRules;

  constructor(manifest: MangaSourceManifest, private readonly builtin: Base) {
    super({ id: builtin.id, name: manifest.name, shortName: manifest.shortName, description: manifest.description, score: manifest.score, href: builtin.href, userAgent: builtin.userAgent, defaultHeaders: builtin.defaultHeaders, option: builtin.option, disabled: !manifest.enabled, batchDelay: builtin.batchDelay, injectedJavaScript: builtin.injectedJavaScript });
    this.declarative = new DeclarativeSource({ ...manifest, engine: 'declarative' }, builtin.defaultHeaders);
    this.rules = (manifest.rules ?? {}) as MangaSourceRules;
  }

  syncExtraData(data: Record<string, any>) { return this.builtin.syncExtraData(data); }
  prepareSearchFetch(keyword: string, page: number, filter: Record<string, string>) { return this.rules.search ? this.declarative.prepareSearchFetch(keyword, page, filter) : this.builtin.prepareSearchFetch(keyword, page, filter); }
  handleSearch(response: any) { return this.rules.search ? this.declarative.handleSearch(response) : this.builtin.handleSearch(response); }
  prepareDiscoveryFetch(page: number, filter: Record<string, string>) { return this.rules.discovery ? this.declarative.prepareDiscoveryFetch(page, filter) : this.builtin.prepareDiscoveryFetch(page, filter); }
  handleDiscovery(response: any) { return this.rules.discovery ? this.declarative.handleDiscovery(response) : this.builtin.handleDiscovery(response); }
  prepareMangaInfoFetch(mangaId: string) { return this.rules.detail ? this.declarative.prepareMangaInfoFetch(mangaId) : this.builtin.prepareMangaInfoFetch(mangaId); }
  handleMangaInfo(response: any, mangaId?: string) { return this.rules.detail ? this.declarative.handleMangaInfo(response, mangaId) : this.builtin.handleMangaInfo(response, mangaId); }
  prepareChapterListFetch(mangaId: string, page: number) { return this.rules.chapters ? this.declarative.prepareChapterListFetch(mangaId, page) : this.builtin.prepareChapterListFetch(mangaId, page); }
  handleChapterList(response: any, mangaId: string) { return this.rules.chapters ? this.declarative.handleChapterList(response, mangaId) : this.builtin.handleChapterList(response, mangaId); }
  prepareChapterFetch(mangaId: string, chapterId: string, page: number, extra: Record<string, any>) { return this.rules.chapter ? this.declarative.prepareChapterFetch(mangaId, chapterId, page, extra) : this.builtin.prepareChapterFetch(mangaId, chapterId, page, extra); }
  handleChapter(response: any, mangaId: string, chapterId: string, page: number) { return this.rules.chapter ? this.declarative.handleChapter(response, mangaId, chapterId, page) : this.builtin.handleChapter(response, mangaId, chapterId, page); }
}
