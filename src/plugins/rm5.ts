import Base, { Plugin, Options } from './base';
import { MangaStatus, ErrorMessage, ScrambleType } from '@/utils';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';

interface ScriptData<T> {
  props: {
    pageProps: T;
    __N_SSP: boolean;
  };
  page: string;
  query: Record<string, undefined | number | string>;
  buildId: string;
  isFallback: boolean;
  gssp: boolean;
  scriptLoader: string[];
}

interface DiscoverySearchData
  extends ScriptData<{
    books: {
      id: string;
      name: string;
      alias: string[];
      description: string;
      coverUrl: string;
      author: string;
      continued: boolean;
      tags: string[];
      rating: number | null;
      publish: boolean;
      /**
       * @example 2023-10-19T00:00:00.000Z
       */
      updatedAt: string;
      coverUrlRectangle: string;
      coverUrlSquare: string;
    }[];
    tags: { id: string; count: number }[];
    hasNextPage: boolean;
  }> {}

interface MangaData
  extends ScriptData<{
    book: {
      id: string;
      name: string;
      description: string;
      alias: string[];
      tags: string[];
      author: string;
      coverUrl: string;
      coverUrlRectangle: string;
      coverUrlSquare: string;
      rating: number | null;
      continued: boolean;
      viewCount: number;
      publish: boolean;
      /**
       * @example 2023-10-19T00:00:00.000Z
       */
      createdAt: string;
      /**
       * @example 2023-10-19T00:00:00.000Z
       */
      updatedAt: string;
      activeResourceId: string;
      activeResource: {
        id: string;
        description: string;
        coverUrl: string;
        author: string;
        continued: boolean;
        tags: string[];
        chapters: string[];
        resourceKey: string;
        resourceRef: string;
        folderPath: string;
        /**
         * @example 2023-10-19T00:00:00.000Z
         */
        createdAt: string;
        /**
         * @example 2023-10-19T00:00:00.000Z
         */
        updatedAt: string;
        bookId: string;
      };
    };
    onMyShelf: boolean;
    lastReadChapterIndex: number;
    session: string | null;
    adBookBottom: boolean;
    siteDomain: string;
  }> {}

interface ChapterData
  extends ScriptData<{
    bookName: string;
    alias: string[];
    chapterName: string;
    description: string;
    images?: { src: string; scramble: boolean }[];
    chapterAPIPath?: string;
    totalChapter: number;
    tags: string[];
    session: string | null;
    adBookBottom: boolean;
  }> {}

interface ChapterImageData {
  chapter: {
    name: string;
    images: { src: string; scramble: boolean }[];
  };
  description: string;
}

const discoveryOptions = [
  {
    name: 'type',
    options: [
      { label: '選擇分類', value: Options.Default },
      { label: '正妹', value: '正妹' },
      { label: '恋爱', value: '恋爱' },
      { label: '出版漫画', value: '出版漫画' },
      { label: '肉慾', value: '肉慾' },
      { label: '浪漫', value: '浪漫' },
      { label: '大尺度', value: '大尺度' },
      { label: '巨乳', value: '巨乳' },
      { label: '有夫之婦', value: '有夫之婦' },
      { label: '女大生', value: '女大生' },
      { label: '狗血劇', value: '狗血劇' },
      { label: '好友', value: '好友' },
      { label: '調教', value: '調教' },
      { label: '动作', value: '动作' },
      { label: '後宮', value: '後宮' },
      { label: '不倫', value: '不倫' },
    ],
  },
  {
    name: 'status',
    options: [
      { label: '選擇狀態', value: Options.Default },
      { label: '連載中', value: 'true' },
      { label: '已完結', value: 'false' },
    ],
  },
  {
    name: 'sort',
    options: [
      { label: '選擇排序', value: Options.Default },
      { label: '更新日期', value: Options.Default },
      { label: '評分', value: 'rating' },
    ],
  },
];

class RouMan5 extends Base {
  constructor() {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36';
    super({
      score: 5,
      id: Plugin.RM5,
      name: '肉漫屋',
      shortName: 'RM5',
      description: '需要代理，只有韩漫',
      href: 'https://rouman5.com/',
      userAgent,
      defaultHeaders: { Referer: 'https://rouman5.com/', 'User-Agent': userAgent },
      option: { discovery: discoveryOptions, search: [] },
    });
  }

  prepareDiscoveryFetch: Base['prepareDiscoveryFetch'] = (page, { type, status, sort }) => {
    return {
      url: 'https://rouman5.com/books',
      body: {
        tag: type === Options.Default ? undefined : type,
        continued: status === Options.Default ? undefined : status,
        sort: sort === Options.Default ? undefined : sort,
        page,
      },
      headers: new Headers(this.defaultHeaders),
    };
  };
  prepareSearchFetch: Base['prepareSearchFetch'] = (keyword, page) => {
    return {
      url: 'https://rouman5.com/search',
      body: {
        term: keyword,
        page,
      },
      headers: new Headers(this.defaultHeaders),
    };
  };
  prepareMangaInfoFetch: Base['prepareMangaInfoFetch'] = (mangaId) => {
    return {
      url: `https://rouman5.com/books/${mangaId}`,
      headers: new Headers(this.defaultHeaders),
    };
  };
  prepareChapterListFetch: Base['prepareChapterListFetch'] = () => {};
  prepareChapterFetch: Base['prepareChapterFetch'] = (mangaId, chapterId, _page, extra) => {
    return {
      url:
        typeof extra.path === 'string'
          ? `https://rouman5.com${extra.path}`
          : `https://rouman5.com/books/${mangaId}/${chapterId}`,
      headers: new Headers(this.defaultHeaders),
    };
  };

  handleDiscovery: Base['handleDiscovery'] = (text: string | null) => {
    const $ = cheerio.load(text || '');
    const discovery: IncreaseManga[] = [];

    // 查找所有包含 /books/ 的 a 标签
    $('a[href*="/books/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      
      // 提取 mangaId (从 /books/cmli80gja000as68mfymh204i 中提取)
      const mangaIdMatch = href.match(/\/books\/([^\/]+)/);
      if (!mangaIdMatch) return;
      
      const mangaId = mangaIdMatch[1];
      const fullHref = href.startsWith('http') ? href : `https://rouman5.com${href}`;

      // 提取封面图片 (从 background-image:url("...") 中提取)
      let bookCover = '';
      const $coverDiv = $link.find('[style*="background-image"]').first();
      if ($coverDiv.length > 0) {
        const style = $coverDiv.attr('style') || '';
        const coverMatch = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
        if (coverMatch) {
          bookCover = coverMatch[1];
        }
      }

      // 提取标题 - 查找包含 truncate 和 text-foreground 类的元素
      let title = '';
      $link.find('.truncate').each((_, el) => {
        const $el = $(el);
        if ($el.hasClass('text-foreground') || $el.hasClass('text-sm') || $el.hasClass('text-base')) {
          const text = $el.text().trim();
          if (text && !title) {
            title = text;
          }
        }
      });

      // 提取更新时间 (从日期显示中提取，格式如 1/1/1970)
      let updateTime = '';
      $link.find('div').each((_, el) => {
        const text = $(el).text().trim();
        // 匹配 M/D/YYYY 格式的日期
        const dateMatch = text.match(/^(\d+)\/(\d+)\/(\d+)$/);
        if (dateMatch) {
          const [, month, day, year] = dateMatch;
          try {
            updateTime = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).format('YYYY-MM-DD');
          } catch (e) {
            // 日期解析失败，忽略
          }
        }
      });

      // 如果没有找到有效数据，跳过
      if (!mangaId || !title) return;

      discovery.push({
        href: fullHref,
        hash: Base.combineHash(this.id, mangaId),
        source: this.id,
        sourceName: this.name,
        mangaId,
        bookCover: bookCover || '',
        title,
        updateTime: updateTime || '',
        headers: this.defaultHeaders,
        status: MangaStatus.Serial, // 默认设为连载中，因为HTML中没有状态信息
        author: [], // HTML中没有作者信息
        tag: [], // HTML中没有标签信息
      });
    });

    return {
      discovery,
    };
  };

  handleSearch: Base['handleSearch'] = (text: string | null) => {
    const $ = cheerio.load(text || '');
    const search: IncreaseManga[] = [];

    // 查找所有包含 /books/ 的 a 标签
    $('a[href*="/books/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      
      // 提取 mangaId (从 /books/cmli80gja000as68mfymh204i 中提取)
      const mangaIdMatch = href.match(/\/books\/([^\/]+)/);
      if (!mangaIdMatch) return;
      
      const mangaId = mangaIdMatch[1];
      const fullHref = href.startsWith('http') ? href : `https://rouman5.com${href}`;

      // 提取封面图片 (从 background-image:url("...") 中提取)
      let bookCover = '';
      const $coverDiv = $link.find('[style*="background-image"]').first();
      if ($coverDiv.length > 0) {
        const style = $coverDiv.attr('style') || '';
        const coverMatch = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
        if (coverMatch) {
          bookCover = coverMatch[1];
        }
      }

      // 提取标题 - 查找包含 truncate 和 text-foreground 类的元素
      let title = '';
      $link.find('.truncate').each((_, el) => {
        const $el = $(el);
        if ($el.hasClass('text-foreground') || $el.hasClass('text-sm') || $el.hasClass('text-base')) {
          const text = $el.text().trim();
          if (text && !title) {
            title = text;
          }
        }
      });

      // 提取更新时间 (从日期显示中提取，格式如 1/1/1970)
      let updateTime = '';
      $link.find('div').each((_, el) => {
        const text = $(el).text().trim();
        // 匹配 M/D/YYYY 格式的日期
        const dateMatch = text.match(/^(\d+)\/(\d+)\/(\d+)$/);
        if (dateMatch) {
          const [, month, day, year] = dateMatch;
          try {
            updateTime = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).format('YYYY-MM-DD');
          } catch (e) {
            // 日期解析失败，忽略
          }
        }
      });

      // 如果没有找到有效数据，跳过
      if (!mangaId || !title) return;

      search.push({
        href: fullHref,
        hash: Base.combineHash(this.id, mangaId),
        source: this.id,
        sourceName: this.name,
        mangaId,
        bookCover: bookCover || '',
        title,
        updateTime: updateTime || '',
        headers: this.defaultHeaders,
        status: MangaStatus.Serial, // 默认设为连载中，因为HTML中没有状态信息
        author: [], // HTML中没有作者信息
        tag: [], // HTML中没有标签信息
      });
    });

    return {
      search,
    };
  };

  handleMangaInfo: Base['handleMangaInfo'] = (text: string | null) => {
    const $ = cheerio.load(text || '');

    // 提取 mangaId - 从章节链接中提取
    let mangaId = '';
    const firstChapterLink = $('a[href*="/books/"][href*="/"]').first();
    if (firstChapterLink.length > 0) {
      const href = firstChapterLink.attr('href') || '';
      const match = href.match(/\/books\/([^\/]+)\//);
      if (match) {
        mangaId = match[1];
      }
    }

    if (!mangaId) {
      return { error: new Error('无法提取 mangaId') };
    }

    // 提取标题
    const title = $('.text-xl.text-foreground').first().text().trim() || '';

    // 提取封面图片
    const bookCover = $('img[alt*="cover"]').first().attr('src') || '';

    // 提取作者
    let author: string[] = [];
    const authorDiv = Array.from($('div')).find((el) => $(el).text().includes('作者:'));
    if (authorDiv) {
      const authorText = $(authorDiv).find('.text-foreground').first().text().trim();
      if (authorText) {
        // 处理 &amp; 转义，并按 & 分割
        author = authorText.replace(/&amp;/g, '&').split('&').map(a => a.trim()).filter(a => a);
      }
    }

    // 提取状态
    let status = MangaStatus.Serial; // 默认连载中
    const statusDiv = Array.from($('div')).find((el) => $(el).text().includes('狀態:'));
    if (statusDiv) {
      const statusText = $(statusDiv).find('.text-foreground').first().text().trim();
      if (statusText === '已完結' || statusText === '完結') {
        status = MangaStatus.End;
      }
    }

    // 提取标签
    let tag: string[] = [];
    const tagDiv = Array.from($('div')).find((el) => $(el).text().includes('標籤:'));
    if (tagDiv) {
      const tagText = $(tagDiv).find('.text-foreground').first().text().trim();
      if (tagText) {
        tag = tagText.split(',').map(t => t.trim()).filter(t => t);
      }
    }

    // 提取更新时间
    let updateTime = '';
    $('div').each((_, el) => {
      const text = $(el).text().trim();
      const dateMatch = text.match(/^(\d+)\/(\d+)\/(\d+)$/);
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        try {
          updateTime = dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).format('YYYY-MM-DD');
        } catch (e) {
          // 日期解析失败，忽略
        }
      }
    });

    // 提取章节列表
    const chapters: ChapterItem[] = [];
    $('a[href*="/books/"][href*="/"]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href') || '';
      const chapterMatch = href.match(/\/books\/[^\/]+\/(\d+)/);
      if (chapterMatch) {
        const chapterId = chapterMatch[1];
        const chapterTitle = $link.find('.text.truncate').first().text().trim() || '';
        if (chapterTitle) {
          chapters.push({
            hash: Base.combineHash(this.id, mangaId, chapterId),
            mangaId,
            chapterId,
            href: href.startsWith('http') ? href : `https://rouman5.com${href}`,
            title: chapterTitle,
          });
        }
      }
    });

    // 反转章节列表（从旧到新）
    chapters.reverse();

    // 获取最新章节标题
    const latest = chapters.length > 0 ? chapters[chapters.length - 1].title : undefined;

    return {
      manga: {
        href: `https://rouman5.com/books/${mangaId}`,
        hash: Base.combineHash(this.id, mangaId),
        source: this.id,
        sourceName: this.name,
        mangaId,
        title,
        latest,
        updateTime: updateTime || '',
        author: author.length > 0 ? author : [],
        tag: tag.length > 0 ? tag : [],
        status,
        chapters,
      },
    };
  };
  handleChapterList: Base['handleChapterList'] = () => {
    return { error: new Error(ErrorMessage.NoSupport + 'handleChapterList') };
  };

  handleChapter: Base['handleChapter'] = (
    res: string | ChapterImageData,
    mangaId: string,
    chapterId: string
  ) => {
    if (typeof res === 'string') {
      const $ = cheerio.load(res || '');

      // 提取所有 script 标签的内容
      let allScriptContent = '';
      $('script').each((_, element) => {
        const scriptContent = $(element).html() || '';
        if (scriptContent.includes('self.__next_f.push')) {
          allScriptContent += scriptContent + '\n';
        }
      });

      // 提取 bookName 和 chapterName - 先从 HTML 中提取（更可靠）
      let bookName = $('.text-lg.text-foreground').first().text().trim() || '';
      let chapterName = '';
      
      const textForegroundElements = Array.from($('.text-foreground'));
      for (const el of textForegroundElements) {
        const $el = $(el);
        if (!$el.hasClass('text-lg')) {
          const text = $el.text().trim();
          if (text && text !== bookName) {
            chapterName = text;
            break;
          }
        }
      }

      // 从 script 内容中提取图片 URL 和索引
      // 匹配格式: "backgroundImage":"url(\"https://...\")" 或 "imageUrl":"..."
      const imagePairs: Array<{ ind: number; imageUrl: string }> = [];
      
      // 匹配所有可能的图片 URL 格式
      let match;
      
      // 1. 优先匹配 imageUrl 格式（带 ind）: "imageUrl":"https://..."..."ind":数字
      // 格式: "imageUrl":"URL","ind":数字 或 "imageUrl":"URL"..."ind":数字
      const imageUrlWithIndRegex = /https?:\/\/[^\\"]+?\.(?:jpg|jpeg|png|webp|gif)/gi;
      while ((match = imageUrlWithIndRegex.exec(allScriptContent)) !== null) {
        const imageUrl = match[1];
        const ind = 0;
        imagePairs.push({ ind, imageUrl });
      }

      // 按 ind 排序
      // imagePairs.sort((a, b) => a.ind - b.ind);
      
      // 构建图片列表
      const images = imagePairs.map((pair) => {
        const uri = pair.imageUrl;
        const isGif = uri?.includes('.gif');
        const hasScramble = uri?.includes('sr:1');
        const needUnscramble = !isGif && hasScramble;
        
        return {
          uri,
          needUnscramble,
        };
      });

      // 检查是否有下一页
      let chapterAPIPath: string | undefined;
      const nextPageLink = $('a[href*="/books/"][href*="/"]').filter((_, el) => {
        const $link = $(el);
        const text = $link.text();
        return text?.includes('下一頁') || text?.includes('下一页');
      }).first();
      
      if (nextPageLink.length > 0) {
        const href = nextPageLink.attr('href');
        const isDisabled = nextPageLink.find('button[disabled]').length > 0;
        if (href && !isDisabled) {
          chapterAPIPath = href;
        }
      }
      return {
        canLoadMore: typeof chapterAPIPath === 'string' && chapterAPIPath.length > 0,
        chapter: {
          hash: Base.combineHash(this.id, mangaId, chapterId),
          mangaId,
          chapterId,
          name: bookName,
          title: chapterName,
          headers: this.defaultHeaders,
          images: images.map((item) => ({
            uri: item.uri,
            scrambleType: ScrambleType.RM5,
            needUnscramble: item.needUnscramble,
          })),
        },
        nextExtra: chapterAPIPath ? { path: chapterAPIPath } : undefined,
      };
    } else {
      const { name, images } = res.chapter;

      return {
        canLoadMore: false,
        chapter: {
          hash: Base.combineHash(this.id, mangaId, chapterId),
          mangaId,
          chapterId,
          title: name,
          headers: this.defaultHeaders,
          images: images.map((item) => ({
            uri: item.src,
            scrambleType: ScrambleType.RM5,
            needUnscramble: !item.src.includes('.gif') && item.scramble,
          })),
        },
      };
    }
  };
}

export default new RouMan5();
