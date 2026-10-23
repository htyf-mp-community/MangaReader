jest.mock('@/utils', () => ({
  clearAllCookie: jest.fn(),
  ErrorMessage: { CloudflareFail: 'Cloudflare', NoSupport: 'NoSupport' },
  MangaStatus: { Unknown: 0, Serial: 1, End: 2 },
  ScrambleType: {},
  AESDecrypt: jest.fn(),
  ellipsis: (value: string) => value,
}));
jest.mock('query-string', () => ({
  __esModule: true,
  default: { parseUrl: (value: string) => ({ url: value }), stringify: () => '' },
}));
jest.mock('react-native-nitro-cookies', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));

import { builtinSourceManifests, DeclarativeSource, mergeUserSources, parseImportedSources, parseRule, parseSourceManifest, readHtmlRule, readJsonPath, readJsonRule, renderSourceTemplate, renderSourceValueTemplate } from '@/source-rules';

const dynamicSource = {
  version: 1 as const,
  id: 'example.source', name: '示例源', shortName: '示例', description: '测试',
  baseUrl: 'https://example.test/', score: 3, enabled: true,
  engine: 'declarative' as const,
  capabilities: ['search' as const, 'detail' as const, 'chapters' as const, 'images' as const],
  rules: {
    search: {
      request: { url: '/search?q={{keyword}}&page={{page}}' },
      format: 'html' as const,
      list: '.item',
      fields: { title: '.title@text|trim', mangaId: 'a@href|regex:/comic/([^/]+)', href: 'a@href|url', cover: 'img@src|url' },
    },
    detail: {
      request: { url: '/comic/{{mangaId}}' }, format: 'html' as const,
      fields: { title: 'h1@text|trim', cover: '.cover@src|url', author: '.author@text|trim' },
      chapters: { list: '.chapters a', fields: { title: '@text|trim', chapterId: '@href|regex:/chapter/([^/]+)', href: '@href|url' } },
    },
    chapter: {
      request: { url: '/chapter/{{chapterId}}' }, format: 'html' as const,
      title: 'h1@text|trim', images: { list: '.reader img', value: '@data-src|url' },
      imageHeaders: { Referer: 'https://example.test/' },
    },
  },
};

describe('MangaReader JSON 漫画源 v1', () => {
  test('BZM 最后一页结束加载，缺失图片地址不能变成站点首页', () => {
    const manifest = builtinSourceManifests.find((item) => item.id === 'BZM')!;
    const source = new DeclarativeSource(manifest);
    const result = source.handleChapter('<div class="comic-contain"><div><amp-img src="https://img.test/1.jpg"></amp-img></div><div>广告</div></div><div class="next_chapter"><a href="/next">下一章</a></div>', 'abc', '2_8', 2);
    expect(result.canLoadMore).toBe(false);
    expect(result.chapter?.images).toEqual([{ uri: 'https://img.test/1.jpg' }]);
  });
  test('14 个内置漫画源均由唯一 JSON 清单注册', () => {
    expect(builtinSourceManifests).toHaveLength(14);
    expect(new Set(builtinSourceManifests.map((item) => item.id)).size).toBe(14);
    expect(builtinSourceManifests.every((item) => item.version === 1)).toBe(true);
  });

  test('14 个 JSON 清单保持原插件展示元数据', () => {
    const expected = {
      COPY: ['拷贝漫画', '', 'https://mangacopy.com/', 5, true],
      MBZ: ['漫画bz', '需要代理', 'https://mangabz.com', 5, true],
      HAPPY: ['嗨皮漫画', '已失效', 'https://m.happymh.com/', 0, false],
      MHGM: ['漫画柜mobile', '需要代理，频繁访问会封IP', 'https://m.manhuagui.com', 5, true],
      JMC: ['禁漫天堂', '需要代理，屏蔽日本ip', 'https://18comic.vip', 5, true],
      NH: ['nhentai', '需要代理', 'https://nhentai.net/', 5, true],
      PICA: ['哔咔漫画', '需要代理', 'https://manhuabika.com/plogin/', 5, true],
      RM5: ['肉漫屋', '需要代理，只有韩漫', 'https://rouman5.com/', 5, true],
      KL: ['kl漫画', '不维护', 'https://klmanga.net', 1, false],
      BZM: ['包子漫画', '国漫', 'https://cn.baozimhcn.com/', 4, true],
      DMZJ: ['动漫之家mobile', '需要登录账号', 'https://m.idmzj.com', 3, true],
      MHDB: ['漫画db', '不维护', 'https://www.manhuadb.com', 1, false],
      MHM: ['漫画猫', '已失效', 'https://www.maofly.com', 0, false],
      MHG: ['漫画柜', '已失效', 'https://www.mhgui.com', 0, false],
    };
    expect(Object.fromEntries(builtinSourceManifests.map(({ id, name, description, baseUrl, score, enabled }) => [id, [name, description, baseUrl, score, enabled]]))).toEqual(expected);
  });

  test('拒绝脚本字段和无效版本', () => {
    expect(() => parseSourceManifest({ version: 2 })).toThrow('版本');
    expect(() => parseSourceManifest({ version: 1, id: 'xx', name: 'x', shortName: 'x', description: '', baseUrl: 'https://x.test', score: 1, enabled: true, capabilities: [], engine: 'declarative', rules: {}, script: 'evil' })).toThrow('脚本');
  });

  test('解析 CSS 字段和安全转换管道', () => {
    expect(parseRule('a@href|trim|url')).toEqual({ selector: 'a', attribute: 'href', transforms: ['trim', 'url'] });
    expect(readHtmlRule('<a href="/comic/42"> 标题 </a>', 'a@href|url', 'https://example.test/root')).toBe('https://example.test/comic/42');
    expect(readHtmlRule('<a> 标题 </a>', 'a@text|trim', 'https://example.test')).toBe('标题');
  });

  test('解析 JSONPath、转换和请求模板', () => {
    const data = { items: [{ name: ' One ' }, { name: 'Two' }] };
    expect(readJsonPath(data, '$.items[*]')).toHaveLength(2);
    expect(readJsonRule(data.items[0], '$.name|trim|upper', '')).toBe('ONE');
    expect(renderSourceTemplate('/search?q={{keyword}}&page={{page}}', { keyword: '海 贼', page: 2 })).toBe('/search?q=%E6%B5%B7%20%E8%B4%BC&page=2');
    expect(renderSourceValueTemplate('{{type|default:all}}', { type: '$$DEFAULT$$' })).toBe('all');
  });

  test('导入声明式源并以 id 合并更新', () => {
    expect(parseImportedSources(JSON.stringify(dynamicSource))[0].id).toBe('example.source');
    expect(mergeUserSources([dynamicSource], [{ ...dynamicSource, name: '新版' }])[0].name).toBe('新版');
    expect(() => parseImportedSources(JSON.stringify({ ...dynamicSource, engine: 'builtin', builtin: 'COPY' }))).toThrow('declarative');
  });

  test('声明式源能够生成请求并解析搜索结果', () => {
    const source = new DeclarativeSource(dynamicSource);
    expect(source.prepareSearchFetch('海 贼', 2).url).toBe('https://example.test/search?q=%E6%B5%B7%20%E8%B4%BC&page=2');
    const result = source.handleSearch('<div class="item"><a href="/comic/42"><span class="title">作品</span></a><img src="/42.jpg"></div>');
    if (!('search' in result) || !result.search) throw new Error('搜索解析失败');
    expect(result.search[0]).toMatchObject({ mangaId: '42', title: '作品', bookCover: 'https://example.test/42.jpg' });
  });

  test('声明式源解析详情、目录和章节图片', () => {
    const source = new DeclarativeSource(dynamicSource);
    const detail = source.handleMangaInfo('<h1>作品</h1><img class="cover" src="/c.jpg"><span class="author">作者</span><div class="chapters"><a href="/chapter/7">第七话</a></div>', '42');
    if (!('manga' in detail) || !detail.manga) throw new Error('详情解析失败');
    expect(detail.manga).toMatchObject({ mangaId: '42', title: '作品', infoCover: 'https://example.test/c.jpg' });
    expect(detail.manga.chapters?.[0]).toMatchObject({ chapterId: '7', title: '第七话' });
    const chapter = source.handleChapter('<h1>第七话</h1><div class="reader"><img data-src="/1.jpg"><img data-src="/2.jpg"></div>', '42', '7');
    if (!('chapter' in chapter) || !chapter.chapter) throw new Error('章节解析失败');
    expect(chapter.chapter.images).toEqual([{ uri: 'https://example.test/1.jpg' }, { uri: 'https://example.test/2.jpg' }]);
  });

  test('BZM 清单的搜索与发现规则可实际执行', () => {
    const manifest = builtinSourceManifests.find((item) => item.id === 'BZM');
    if (!manifest) throw new Error('缺少 BZM 清单');
    const source = new DeclarativeSource({ ...manifest, engine: 'declarative' });
    const discovery = source.handleDiscovery({ items: [{ comic_id: 'abc', name: '漫画', topic_img: 'a.jpg', author: '作者', type_names: ['热血'] }] });
    if (!('discovery' in discovery) || !discovery.discovery) throw new Error('发现解析失败');
    expect(discovery.discovery[0]).toMatchObject({ mangaId: 'abc', title: '漫画', href: 'https://cn.baozimhcn.com/comic/abc', bookCover: 'https://static-tw.baozimh.com/cover/a.jpg' });
    const search = source.handleSearch('<div class="classify-items"><div><a class="comics-card__poster" href="/comic/abc"><amp-img src="/a.jpg"></amp-img></a><div class="comics-card__info"><div class="comics-card__title">漫画</div><div class="tags">作者</div></div></div></div>');
    if (!('search' in search) || !search.search) throw new Error('搜索解析失败');
    expect(search.search[0]).toMatchObject({ mangaId: 'abc', title: '漫画' });
  });

  test('BZM 清单完整解析详情、目录和多页图片', () => {
    const manifest = builtinSourceManifests.find((item) => item.id === 'BZM');
    if (!manifest) throw new Error('缺少 BZM 清单');
    const source = new DeclarativeSource({ ...manifest, engine: 'declarative' });
    const detail = source.handleMangaInfo('<meta name="og:url" content="https://cn.baozimhcn.com/comic/abc"><div class="comics-detail"><div class="l-content"><amp-img src="/cover.jpg"></amp-img><div class="comics-detail__title">漫画</div><div class="comics-detail__author">作者</div><div class="tag-list"><span class="tag">热血</span><span class="tag">连载中</span></div><div class="supporting-text"><div><a>第2话</a><em>2026年09月03日 更新</em></div></div></div></div><div id="chapter-items"><div><a href="/?section_slot=2&chapter_slot=8"><span>第2话</span></a></div></div>', 'abc');
    if (!('manga' in detail) || !detail.manga) throw new Error('BZM 详情解析失败');
    expect(detail.manga).toMatchObject({ mangaId: 'abc', title: '漫画', updateTime: '2026-09-03', status: 1, tag: ['热血'] });
    expect(detail.manga.chapters?.[0]).toMatchObject({ chapterId: '2_8', title: '第2话' });
    const page = '<div class="comic-chapter"><div class="header"><div class="l-content"><div class="title">第2话</div></div></div></div><div class="comic-contain"><div><amp-img src="https://img.test/1.jpg"></amp-img></div></div><div class="next_chapter"><a href="/comic/chapter/abc/2_8_2.html">下一页</a></div>';
    const chapter = source.handleChapter(page, 'abc', '2_8', 1);
    if (!('chapter' in chapter) || !chapter.chapter) throw new Error('BZM 章节解析失败');
    expect(chapter.canLoadMore).toBe(true);
    expect(chapter.chapter.images).toEqual([{ uri: 'https://img.test/1.jpg' }]);
    expect(source.prepareChapterFetch('abc', '2_8', 2, chapter.nextExtra).url).toBe('https://cn.czmanga.com/comic/chapter/abc/2_8_2.html');
  });

  test('NH 发现规则由 JSON 执行并继承内置请求头', () => {
    const manifest = builtinSourceManifests.find((item) => item.id === 'NH');
    if (!manifest) throw new Error('缺少 NH 清单');
    const source = new DeclarativeSource({ ...manifest, engine: 'declarative' }, { Host: 'nhentai.net' });
    expect(source.prepareDiscoveryFetch(3, {})).toMatchObject({ url: 'https://nhentai.net/?page=3', headers: { Host: 'nhentai.net' } });
    const result = source.handleDiscovery('<div id="content"><div class="container index-container"><div class="gallery"><a class="cover" href="/g/123/"><img class="lazyload" data-src="https://t.test/123.jpg"><div class="caption">作品</div></a></div></div></div>');
    if (!('discovery' in result) || !result.discovery) throw new Error('NH 发现解析失败');
    expect(result.discovery[0]).toMatchObject({ mangaId: '123', title: '作品', href: 'https://nhentai.net/g/123/', status: 2 });
  });
});
