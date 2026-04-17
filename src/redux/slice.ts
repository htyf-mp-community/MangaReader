/**
 * Redux Slice 定义文件
 * 
 * 功能说明：
 * 1. 定义应用的初始状态（initialState）
 * 2. 使用 Redux Toolkit 的 createSlice 创建各个功能模块的 slice
 * 3. 导出所有 action creators 和 reducers
 * 
 * 模块划分：
 * - app: 应用启动状态和消息提示
 * - datasync: 数据同步、备份、恢复、清空缓存
 * - release: 版本信息
 * - setting: 用户设置（布局模式、亮度、阅读方向等）
 * - plugin: 插件管理
 * - batch: 批量更新漫画
 * - search: 搜索功能
 * - discovery: 发现页
 * - favorites: 收藏列表
 * - manga: 漫画加载状态
 * - chapter: 章节加载状态
 * - task: 下载/导出任务管理
 * - dict: 数据字典（漫画、章节、记录、最后观看）
 */

import {
  AsyncStatus,
  MangaStatus,
  Sequence,
  LayoutMode,
  LightSwitch,
  ReaderDirection,
  MultipleSeat,
  Hearing,
  Timer,
  Animated,
} from '@/utils';
import { createSlice, combineReducers, PayloadAction } from '@reduxjs/toolkit';
import { Plugin, defaultPlugin, defaultPluginList } from '@/plugins';
import { Dirs } from 'react-native-file-access';

// ==================== 初始状态定义 ====================

/**
 * 应用的初始状态
 * 定义了所有 Redux state 的默认值
 */
export const initialState: RootState = {
  app: {
    launchStatus: AsyncStatus.Default,
    message: [],
  },
  datasync: {
    syncStatus: AsyncStatus.Default,
    clearStatus: AsyncStatus.Default,
    backupStatus: AsyncStatus.Default,
    restoreStatus: AsyncStatus.Default,
  },
  release: {
    loadStatus: AsyncStatus.Default,
    name: process?.env?.NAME || '',
    version: process?.env?.VERSION || '',
    publishTime: process?.env?.PUBLISH_TIME || '',
  },
  setting: {
    mode: LayoutMode.Horizontal,
    light: LightSwitch.Off,
    direction: ReaderDirection.Right,
    sequence: Sequence.Desc,
    seat: MultipleSeat.AToB,
    hearing: Hearing.Enable,
    timer: Timer.Disabled,
    animated: Animated.Enable,
    timerGap: 5000,
    androidDownloadPath: Dirs.SDCardDir + '/DCIM/{{CHAPTER_NAME}}',
  },
  plugin: {
    source: defaultPlugin,
    list: defaultPluginList,
    extra: {},
  },
  batch: {
    loadStatus: AsyncStatus.Default,
    stack: [],
    queue: [],
    success: [],
    fail: [],
  },
  search: {
    filter: {},
    keyword: '',
    page: 1,
    isEnd: false,
    loadStatus: AsyncStatus.Default,
    list: [],
  },
  discovery: {
    filter: {},
    page: 1,
    isEnd: false,
    loadStatus: AsyncStatus.Default,
    list: [],
  },
  favorites: [],
  manga: {
    loadStatus: AsyncStatus.Default,
    loadingMangaHash: '',
  },
  chapter: {
    loadStatus: AsyncStatus.Default,
    loadingChapterHash: '',
    openDrawer: false,
    showDrawer: false,
  },
  task: {
    list: [],
    job: {
      max: 5,
      list: [],
      thread: [],
    },
  },
  dict: {
    manga: {}, // 漫画数据字典（key: mangaHash）
    chapter: {}, // 章节数据字典（key: chapterHash）
    record: {}, // 阅读记录字典（key: chapterHash）
    lastWatch: {}, // 最后观看记录字典（key: mangaHash）
  },
};

// ==================== 默认值定义 ====================

/**
 * 默认的增量漫画数据结构
 * 用于合并搜索结果和发现页数据时提供默认值
 */
const defaultIncreaseManga = {
  latest: '',
  updateTime: '',
  bookCover: '',
  infoCover: '',
  author: [],
  tag: [],
  status: MangaStatus.Unknown,
  chapters: [],
};

// ==================== Slice 定义 ====================

/**
 * 应用状态 Slice
 * 管理应用启动状态和消息提示队列
 */
const appSlice = createSlice({
  name: 'app',
  initialState: initialState.app,
  reducers: {
    /**
     * 启动应用
     * 将启动状态设置为 Pending
     */
    launch(state) {
      state.launchStatus = AsyncStatus.Pending;
    },
    
    /**
     * 启动完成
     * 根据是否有错误设置启动状态
     */
    launchCompletion(state, action: FetchResponseAction) {
      if (action.payload.error) {
        state.launchStatus = AsyncStatus.Rejected;
        return;
      }
      state.launchStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 添加提示消息
     * 将消息添加到消息队列
     */
    toastMessage(state, action: PayloadAction<string>) {
      state.message.push(action.payload);
    },
    
    /**
     * 清空消息队列
     */
    throwMessage(state) {
      state.message = [];
    },
  },
});

/**
 * 数据同步 Slice
 * 管理数据同步、备份、恢复、清空缓存的状态
 */
const datasyncSlice = createSlice({
  name: 'datasync',
  initialState: initialState.datasync,
  reducers: {
    /**
     * 开始同步数据
     */
    syncData(state) {
      state.syncStatus = AsyncStatus.Pending;
    },
    
    /**
     * 同步数据完成
     */
    syncDataCompletion(state, action: FetchResponseAction) {
      if (action.payload.error) {
        state.syncStatus = AsyncStatus.Rejected;
        return;
      }
      state.syncStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 开始备份
     */
    backup(state) {
      state.backupStatus = AsyncStatus.Pending;
    },
    
    /**
     * 备份完成
     */
    backupCompletion(state, action: FetchResponseAction) {
      if (action.payload.error) {
        state.backupStatus = AsyncStatus.Rejected;
        return;
      }
      state.backupStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 开始恢复
     */
    restore(state) {
      state.restoreStatus = AsyncStatus.Pending;
    },
    
    /**
     * 恢复完成
     */
    restoreCompletion(state, action: FetchResponseAction) {
      if (action.payload.error) {
        state.restoreStatus = AsyncStatus.Rejected;
        return;
      }
      state.restoreStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 开始清空缓存
     */
    clearCache(state) {
      state.clearStatus = AsyncStatus.Pending;
    },
    
    /**
     * 清空缓存完成
     */
    clearCacheCompletion(state, action: FetchResponseAction) {
      if (action.payload.error) {
        state.clearStatus = AsyncStatus.Rejected;
        return;
      }
      state.clearStatus = AsyncStatus.Fulfilled;
    },
  },
});

/**
 * 版本信息 Slice
 * 管理应用版本和最新发布信息
 */
const releaseSlice = createSlice({
  name: 'release',
  initialState: initialState.release,
  reducers: {
    /**
     * 开始加载最新版本信息
     */
    loadLatestRelease(state) {
      state.loadStatus = AsyncStatus.Pending;
      state.latest = undefined;
    },
    
    /**
     * 加载最新版本信息完成
     */
    loadLatestReleaseCompletion(state, action: FetchResponseAction<LatestRelease>) {
      const { error, data } = action.payload;

      if (error) {
        state.loadStatus = AsyncStatus.Rejected;
        return;
      }

      state.loadStatus = AsyncStatus.Fulfilled;
      state.latest = data;
    },
  },
});

/**
 * 设置 Slice
 * 管理用户的各种设置选项
 */
const settingSlice = createSlice({
  name: 'setting',
  initialState: initialState.setting,
  reducers: {
    /**
     * 设置布局模式（横向/纵向/双页）
     */
    setMode(state, action: PayloadAction<LayoutMode>) {
      state.mode = action.payload;
    },
    
    /**
     * 设置亮度模式（日间/夜间）
     */
    setLight(state, action: PayloadAction<LightSwitch>) {
      state.light = action.payload;
    },
    
    /**
     * 设置阅读方向（从左到右/从右到左）
     */
    setDirection(state, action: PayloadAction<ReaderDirection>) {
      state.direction = action.payload;
    },
    
    /**
     * 设置章节排序顺序（升序/降序）
     */
    setSequence(state, action: PayloadAction<Sequence>) {
      state.sequence = action.payload;
    },
    
    /**
     * 设置双页模式下的阅读顺序
     */
    setSeat(state, action: PayloadAction<MultipleSeat>) {
      state.seat = action.payload;
    },
    
    /**
     * 设置音量键翻页开关
     */
    setHearing(state, action: PayloadAction<Hearing>) {
      state.hearing = action.payload;
    },
    
    /**
     * 设置定时翻页开关
     */
    setTimer(state, action: PayloadAction<Timer>) {
      state.timer = action.payload;
    },
    
    /**
     * 设置定时翻页间隔（毫秒）
     */
    setTimerGap(state, action: PayloadAction<number>) {
      state.timerGap = action.payload;
    },
    
    /**
     * 设置翻页动画开关
     */
    setAnimated(state, action: PayloadAction<Animated>) {
      state.animated = action.payload;
    },
    
    /**
     * 设置 Android 下载路径（支持模板变量）
     */
    setAndroidDownloadPath(state, action: PayloadAction<string>) {
      state.androidDownloadPath = action.payload;
    },
    
    /**
     * 同步设置（从备份恢复时使用）
     * 直接替换整个 setting 状态
     */
    syncSetting(_state, action: PayloadAction<RootState['setting']>) {
      return action.payload;
    },
  },
  extraReducers: (builder) => {
    // 清空缓存时重置设置
    builder.addCase(datasyncAction.clearCache, () => {
      return initialState.setting;
    });
  },
});

/**
 * 插件 Slice
 * 管理插件列表、当前使用的插件、插件额外数据
 */
const pluginSlice = createSlice({
  name: 'plugin',
  initialState: initialState.plugin,
  reducers: {
    /**
     * 设置当前使用的插件源
     */
    setSource(state, action: PayloadAction<Plugin>) {
      state.source = action.payload;
    },
    
    /**
     * 设置插件的额外数据
     * 用于存储插件的自定义配置
     */
    setExtra(state, action: PayloadAction<{ source: Plugin; data: Record<string, any> }>) {
      state.extra = { ...state.extra, ...action.payload.data };
    },
    
    /**
     * 启用/禁用插件
     */
    disablePlugin(state, action: PayloadAction<Plugin>) {
      const index = state.list.findIndex((item) => item.value === action.payload);

      if (index !== -1) {
        state.list[index].disabled = !state.list[index].disabled;
      }
    },
    
    /**
     * 排序插件列表
     */
    sortPlugin(state, action: PayloadAction<RootState['plugin']['list']>) {
      state.list = action.payload;
    },
    
    /**
     * 同步插件数据（从备份恢复时使用）
     */
    syncPlugin(_state, action: PayloadAction<RootState['plugin']>) {
      return action.payload;
    },
  },
  extraReducers: (builder) => {
    // 清空缓存时重置插件
    builder.addCase(datasyncAction.clearCache, () => {
      return initialState.plugin;
    });
  },
});

/**
 * 批量更新 Slice
 * 管理批量更新漫画的状态和队列
 */
const batchSlice = createSlice({
  name: 'batch',
  initialState: initialState.batch,
  reducers: {
    /**
     * 批量更新（触发 saga）
     * 这是一个空 reducer，实际逻辑在 saga 中处理
     */
    batchUpdate(_state, _action: PayloadAction<string[] | undefined>) {},
    
    /**
     * 开始批量更新
     * 初始化队列和状态
     */
    startBatchUpdate(state, action: PayloadAction<string[]>) {
      state.loadStatus = AsyncStatus.Pending;
      state.queue = action.payload;
      state.success = [];
      state.fail = [];
    },
    
    /**
     * 结束批量更新
     */
    endBatchUpdate(state) {
      state.loadStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 将漫画哈希加入处理栈
     * 从队列中移除，表示正在处理
     */
    inStack(state, action: PayloadAction<string>) {
      state.stack.push(action.payload);
      state.queue = state.queue.filter((item) => item !== action.payload);
    },
    
    /**
     * 将漫画哈希移出处理栈
     * 根据处理结果加入成功或失败列表
     * 
     * @param isSuccess - 是否成功
     * @param isTrend - 是否有更新（章节数增加）
     * @param hash - 漫画哈希
     * @param isRetry - 是否重试（失败但会重试的加入队列）
     */
    outStack(
      state,
      action: PayloadAction<{
        isSuccess: boolean;
        isTrend: boolean;
        hash: string;
        isRetry: boolean;
      }>
    ) {
      const { isSuccess, hash, isRetry } = action.payload;
      state.stack = state.stack.filter((item) => item !== hash);
      if (isSuccess) {
        state.success.push(hash);
      } else {
        // 如果会重试，重新加入队列；否则加入失败列表
        isRetry ? state.queue.push(hash) : state.fail.push(hash);
      }
    },
    
    /**
     * 取消加载漫画（触发 saga）
     */
    cancelLoadManga() {},
  },
});

/**
 * 搜索 Slice
 * 管理搜索功能的状态和结果
 */
const searchSlice = createSlice({
  name: 'search',
  initialState: initialState.search,
  reducers: {
    /**
     * 设置搜索筛选条件
     */
    setSearchFilter(state, action: PayloadAction<Record<string, string>>) {
      state.filter = {
        ...state.filter,
        ...action.payload,
      };
    },
    
    /**
     * 重置搜索筛选条件
     */
    resetSearchFilter(state) {
      state.filter = {};
    },
    
    /**
     * 加载搜索结果
     * 
     * @param keyword - 搜索关键词
     * @param isReset - 是否重置（重置页码和列表）
     * @param source - 插件源
     */
    loadSearch(
      state,
      action: PayloadAction<{ keyword: string; isReset?: boolean; source: Plugin }>
    ) {
      const { keyword, isReset = false } = action.payload;
      if (isReset) {
        state.page = 1;
        state.list = [];
        state.isEnd = false;
      }

      state.keyword = keyword;
      state.loadStatus = AsyncStatus.Pending;
    },
    
    /**
     * 加载搜索结果完成
     * 将新结果合并到列表中（去重）
     */
    loadSearchCompletion(state, action: FetchResponseAction<IncreaseManga[]>) {
      const { error, data = [] } = action.payload;
      if (error) {
        state.loadStatus = AsyncStatus.Rejected;
        return;
      }

      // 合并新结果并去重
      const list = Array.from(new Set(state.list.concat(data.map((item) => item.hash))));
      state.page += 1;
      state.loadStatus = AsyncStatus.Fulfilled;
      // 如果列表长度没有变化，说明没有更多数据了
      state.isEnd = list?.length === state.list?.length;
      state.list = list;
    },
  },
});

/**
 * 发现页 Slice
 * 管理发现页的状态和结果列表
 */
const discoverySlice = createSlice({
  name: 'discovery',
  initialState: initialState.discovery,
  reducers: {
    /**
     * 设置发现页筛选条件
     */
    setDiscoveryFilter(state, action: PayloadAction<Record<string, string>>) {
      state.filter = {
        ...state.filter,
        ...action.payload,
      };
    },
    
    /**
     * 加载发现页数据
     * 
     * @param isReset - 是否重置（重置页码和列表）
     * @param source - 插件源
     */
    loadDiscovery(state, action: PayloadAction<{ isReset?: boolean; source: Plugin }>) {
      const isReset = action.payload.isReset || false;
      if (isReset) {
        state.page = 1;
        state.list = [];
        state.isEnd = false;
      }

      state.loadStatus = AsyncStatus.Pending;
    },
    
    /**
     * 加载发现页数据完成
     * 将新结果合并到列表中（去重）
     */
    loadDiscoveryCompletion(state, action: FetchResponseAction<IncreaseManga[]>) {
      const { error, data = [] } = action.payload;
      if (error) {
        state.loadStatus = AsyncStatus.Rejected;
        return;
      }

      // 合并新结果并去重
      const list = Array.from(new Set(state.list.concat(data.map((item) => item.hash))));
      state.page += 1;
      state.loadStatus = AsyncStatus.Fulfilled;
      // 如果列表长度没有变化，说明没有更多数据了
      state.isEnd = list?.length === state.list?.length;
      state.list = list;
    },
  },
  extraReducers: (builder) => {
    // 切换插件源时重置发现页状态
    builder.addCase(pluginAction.setSource, (state) => {
      state.filter = {};
      state.loadStatus = AsyncStatus.Default;
    });
  },
});

/**
 * 收藏 Slice
 * 管理收藏列表的增删改查
 */
const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: initialState.favorites,
  reducers: {
    /**
     * 添加收藏
     * 
     * @param mangaHash - 漫画哈希
     * @param enableBatch - 是否启用批量更新（默认 true）
     */
    addFavorites(state, action: PayloadAction<{ mangaHash: string; enableBatch?: boolean }>) {
      const { mangaHash, enableBatch = true } = action.payload;
      // 添加到列表开头
      state.unshift({ mangaHash, isTrend: false, enableBatch });
    },
    
    /**
     * 移除收藏
     * 支持单个或批量移除
     */
    removeFavorites(state, action: PayloadAction<string | string[]>) {
      if (Array.isArray(action.payload)) {
        return state.filter((item) => !action.payload.includes(item.mangaHash));
      }
      return state.filter((item) => item.mangaHash !== action.payload);
    },
    
    /**
     * 启用批量更新
     */
    enabledBatch(state, action: PayloadAction<string>) {
      return state.map((item) => {
        if (item.mangaHash === action.payload) {
          return {
            ...item,
            enableBatch: true,
          };
        }
        return item;
      });
    },
    
    /**
     * 禁用批量更新
     */
    disabledBatch(state, action: PayloadAction<string>) {
      return state.map((item) => {
        if (item.mangaHash === action.payload) {
          return {
            ...item,
            enableBatch: false,
          };
        }
        return item;
      });
    },
    
    /**
     * 查看收藏（将指定收藏移到列表开头）
     * 同时清除更新标记（isTrend）
     */
    viewFavorites(state, action: PayloadAction<string>) {
      return state.reduce<RootState['favorites']>((dict, item) => {
        if (item.mangaHash === action.payload) {
          return [{ ...item, isTrend: false }, ...dict];
        }
        return [...dict, item];
      }, []);
    },
    
    /**
     * 同步收藏数据（从备份恢复时使用）
     */
    syncFavorites(_state, action: PayloadAction<RootState['favorites']>) {
      return action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 批量更新成功且有新章节时，标记为有更新
      .addCase(batchAction.outStack, (state, action) => {
        const { isSuccess, isTrend, hash } = action.payload;
        if (isSuccess && isTrend) {
          // 将有更新的收藏移到列表开头
          return state.reduce<RootState['favorites']>((dict, item) => {
            if (item.mangaHash === hash) {
              return [{ ...item, isTrend: true }, ...dict];
            }
            return [...dict, item];
          }, []);
        }
      })
      // 清空缓存时重置收藏
      .addCase(datasyncAction.clearCache, () => {
        return initialState.favorites;
      });
  },
});

/**
 * 漫画 Slice
 * 管理漫画加载状态
 */
const mangaSlice = createSlice({
  name: 'manga',
  initialState: initialState.manga,
  reducers: {
    /**
     * 开始加载漫画
     * 
     * @param mangaHash - 漫画哈希
     * @param actionId - 动作 ID（用于区分多个并发请求）
     */
    loadManga(state, action: PayloadAction<{ mangaHash: string; actionId?: string }>) {
      state.loadStatus = AsyncStatus.Pending;
      state.loadingMangaHash = action.payload.mangaHash;
    },
    
    /**
     * 加载漫画完成
     */
    loadMangaCompletion(state, action: FetchResponseAction<IncreaseManga>) {
      const { error } = action.payload;

      state.loadingMangaHash = '';
      if (error) {
        state.loadStatus = AsyncStatus.Rejected;
        return;
      }
      state.loadStatus = AsyncStatus.Fulfilled;
    },
    
    /**
     * 加载漫画详情（触发 saga）
     */
    loadMangaInfo(_state, _action: PayloadAction<{ mangaHash: string; actionId?: string }>) {},
    
    /**
     * 加载漫画详情完成（触发 saga）
     */
    loadMangaInfoCompletion(_state, _action: FetchResponseAction<IncreaseManga>) {},
    
    /**
     * 加载章节列表（触发 saga）
     */
    loadChapterList(_state, _action: PayloadAction<{ mangaHash: string; page: number }>) {},
    
    /**
     * 加载章节列表完成（触发 saga）
     */
    loadChapterListCompletion(
      _state,
      _action: FetchResponseAction<{ mangaHash: string; page: number; list: Manga['chapters'] }>
    ) {},
  },
});

/**
 * 章节 Slice
 * 管理章节加载状态和 UI 状态
 */
const chapterSlice = createSlice({
  name: 'chapter',
  initialState: initialState.chapter,
  reducers: {
    /**
     * 开始加载章节
     */
    loadChapter(state, action: PayloadAction<{ chapterHash: string }>) {
      state.loadStatus = AsyncStatus.Pending;
      state.loadingChapterHash = action.payload.chapterHash;
    },
    
    /**
     * 加载章节完成
     */
    loadChapterCompletion(state, action: FetchResponseAction<Chapter>) {
      const { error } = action.payload;
      state.loadingChapterHash = '';
      if (error) {
        state.loadStatus = AsyncStatus.Rejected;
        return;
      }
      state.loadStatus = AsyncStatus.Fulfilled;
    },

    /**
     * 下载章节（触发 saga）
     */
    downloadChapter: (_state, _action: PayloadAction<string[]>) => {},
    
    /**
     * 导出章节（触发 saga）
     */
    exportChapter: (_state, _action: PayloadAction<string[]>) => {},
    
    /**
     * 保存图片（触发 saga）
     */
    saveImage: (
      _state,
      _action: PayloadAction<{ source: string; headers?: Record<string, string> }>
    ) => {},

    /**
     * 设置预处理日志状态
     * 只有当 showDrawer 为 true 时才能打开
     */
    setPrehandleLogStatus(state, action: PayloadAction<boolean>) {
      state.openDrawer = action.payload && state.showDrawer;
    },
    
    /**
     * 设置预处理日志可见性
     */
    setPrehandleLogVisible(state, action: PayloadAction<boolean>) {
      state.showDrawer = action.payload;
    },
  },
});

/**
 * 任务 Slice
 * 管理下载/导出任务的状态和队列
 */
const missionSlice = createSlice({
  name: 'task',
  initialState: initialState.task,
  reducers: {
    /**
     * 重启任务
     * 重置所有任务状态，将未完成的任务重新加入队列
     */
    restartTask(state) {
      // 重置任务状态
      state.list = state.list.map((item) => ({
        ...item,
        status:
          item.success?.length >= item.queue?.length ? AsyncStatus.Fulfilled : AsyncStatus.Default,
        pending: [],
        fail: [],
      }));
      
      // 清空线程列表
      state.job.thread = [];
      
      // 将未完成的任务重新加入作业队列
      state.job.list = state.list
        .map((task) =>
          task.queue
            .filter((item) => !task.success.includes(item.jobId))
            .map((item) => ({
              taskId: task.taskId,
              jobId: item.jobId,
              chapterHash: task.chapterHash,
              type: task.type,
              status: AsyncStatus.Default,
              source: item.source,
              album: task.title,
              index: item.index,
              headers: task.headers,
            }))
        )
        .flat();
    },
    /**
     * 添加任务
     * 将新任务加入任务列表和作业队列
     */
    pushTask(state, action: FetchResponseAction<Task>) {
      const { error, data: task } = action.payload;
      if (error) {
        return;
      }

      state.list.push(task);
      // 将任务的所有作业加入作业队列
      state.job.list.push(
        ...task.queue.map((item) => ({
          taskId: task.taskId,
          jobId: item.jobId,
          chapterHash: task.chapterHash,
          type: task.type,
          status: AsyncStatus.Default,
          source: item.source,
          album: task.title,
          index: item.index,
          headers: task.headers,
        }))
      );
    },
    
    /**
     * 重试任务
     * 将失败的任务重新加入队列
     */
    retryTask(state, action: PayloadAction<string[]>) {
      action.payload.forEach((taskId) => {
        const task = state.list.find((item) => item.taskId === taskId);
        if (task && task.fail?.length > 0) {
          // 清空该任务相关的作业
          state.job.list = state.job.list.filter((item) => item.taskId !== taskId);
          state.job.thread = state.job.thread.filter((item) => item.taskId !== taskId);
          
          // 将失败的作业重新加入队列
          state.job.list.push(
            ...task.queue
              .filter((item) => task.fail.includes(item.jobId))
              .map((item) => ({
                taskId: task.taskId,
                jobId: item.jobId,
                chapterHash: task.chapterHash,
                type: task.type,
                status: AsyncStatus.Default,
                source: item.source,
                album: task.title,
                index: item.index,
                headers: task.headers,
              }))
          );
          task.fail = [];
          task.status = AsyncStatus.Default;
        }
      });
    },
    
    /**
     * 移除任务
     * 同时移除任务列表、作业队列和线程列表中的相关项
     */
    removeTask(state, action: PayloadAction<string>) {
      state.list = state.list.filter((item) => item.taskId !== action.payload);
      state.job.list = state.job.list.filter((item) => item.taskId !== action.payload);
      state.job.thread = state.job.thread.filter((item) => item.taskId !== action.payload);
    },
    
    /**
     * 完成任务（触发 saga）
     */
    finishTask() {},
    
    /**
     * 开始执行作业
     * 将作业状态设置为 Pending，并加入线程列表
     */
    startJob(state, action: PayloadAction<{ taskId: string; jobId: string }>) {
      const { taskId, jobId } = action.payload;
      const task = state.list.find((item) => item.taskId === taskId);
      const job = state.job.list.find((item) => item.taskId === taskId && item.jobId === jobId);

      if (task && job) {
        task.pending.push(jobId);
        task.status = AsyncStatus.Pending;
        job.status = AsyncStatus.Pending;
        state.job.thread.push({ taskId, jobId });
      }
    },
    
    /**
     * 结束执行作业
     * 根据执行结果更新任务状态
     */
    endJob(state, action: PayloadAction<{ taskId: string; jobId: string; status: AsyncStatus }>) {
      const { taskId, jobId, status } = action.payload;
      const task = state.list.find((item) => item.taskId === taskId);

      if (task) {
        // 从待处理列表中移除
        task.pending = task.pending.filter((item) => item === jobId);
        
        // 从线程列表和作业列表中移除
        state.job.thread = state.job.thread.filter(
          (item) => item.taskId !== taskId || item.jobId !== jobId
        );
        state.job.list = state.job.list.filter(
          (item) => item.taskId !== taskId || item.jobId !== jobId
        );
        
        // 根据执行结果更新成功/失败列表
        if (status === AsyncStatus.Fulfilled) {
          task.success.push(jobId);
        }
        if (status === AsyncStatus.Rejected) {
          task.fail.push(jobId);
        }
        
        // 检查任务是否完成
        if (task.success?.length + task.fail?.length >= task.queue?.length) {
          if (task.fail?.length <= 0) {
            // 全部成功，移除任务
            task.status = AsyncStatus.Fulfilled;
            state.list = state.list.filter((item) => item.taskId !== taskId);
          } else {
            // 有失败，标记为失败状态
            task.status = AsyncStatus.Rejected;
          }
        } else {
          // 还有未完成的作业
          task.status = AsyncStatus.Pending;
        }
      }
    },
    
    /**
     * 完成作业（触发 saga）
     */
    finishJob() {},
    
    /**
     * 同步任务数据（从备份恢复时使用）
     */
    syncTask(_state, action: PayloadAction<RootState['task']>) {
      return action.payload;
    },
  },
});

/**
 * 数据字典 Slice
 * 管理漫画、章节、阅读记录等数据字典
 */
const dictSlice = createSlice({
  name: 'dict',
  initialState: initialState.dict,
  reducers: {
    /**
     * 同步数据字典（从备份恢复时使用）
     */
    syncDict(_state, action: PayloadAction<RootState['dict']>) {
      return action.payload;
    },
    
    /**
     * 记录查看的章节
     * 更新最后观看记录
     */
    viewChapter(
      state,
      action: PayloadAction<{ mangaHash: string; chapterHash: string; chapterTitle: string }>
    ) {
      const { mangaHash, chapterHash, chapterTitle } = action.payload;
      if (!state.lastWatch[mangaHash]) {
        state.lastWatch[mangaHash] = {};
      }
      state.lastWatch[mangaHash].chapter = chapterHash;
      state.lastWatch[mangaHash].title = chapterTitle;
    },
    
    /**
     * 记录查看的页面
     * 更新最后观看的页面索引
     */
    viewPage(state, action: PayloadAction<{ mangaHash: string; page: number }>) {
      const { mangaHash, page } = action.payload;
      if (!state.lastWatch[mangaHash]) {
        state.lastWatch[mangaHash] = {};
      }
      state.lastWatch[mangaHash].page = page;
    },
    
    /**
     * 记录查看的图片
     * 更新章节的阅读进度和已加载图片列表
     * 
     * @param chapterHash - 章节哈希
     * @param index - 图片索引
     * @param isVisited - 是否已访问（默认 true）
     */
    viewImage(
      state,
      action: PayloadAction<{ chapterHash: string; index: number; isVisited?: boolean }>
    ) {
      const { chapterHash, index, isVisited = true } = action.payload;
      const chapter = state.chapter[chapterHash];

      if (chapter) {
        // 初始化记录（如果不存在）
        if (!state.record[chapterHash]) {
          state.record[chapterHash] = {
            total: 0,
            progress: 0,
            imagesLoaded: [],
            isVisited: false,
          };
        }

        const prev = state.record[chapterHash];
        // 将当前图片索引加入已加载列表（去重）
        const imagesLoaded = Array.from(new Set([...prev.imagesLoaded, index]));

        // 更新记录
        state.record[chapterHash] = {
          total: chapter.images?.length,
          // 计算进度百分比（取最大值，避免回退）
          progress: Math.max(
            prev.progress,
            Math.floor((imagesLoaded?.length * 100) / chapter.images?.length)
          ),
          imagesLoaded,
          isVisited: isVisited ? true : prev.isVisited,
        };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // 搜索完成时，将结果合并到漫画字典
      .addCase(searchAction.loadSearchCompletion, (state, action) => {
        const { error, data = [] } = action.payload;
        if (error || !data) {
          return;
        }

        data.forEach((item) => {
          // 合并数据，保留已有数据，用新数据覆盖
          state.manga[item.hash] = {
            ...defaultIncreaseManga,
            ...state.manga[item.hash],
            ...item,
          };
        });
      })
      // 发现页完成时，将结果合并到漫画字典
      .addCase(discoveryAction.loadDiscoveryCompletion, (state, action) => {
        const { error, data = [] } = action.payload;
        if (error || !data) {
          return;
        }

        data.forEach((item) => {
          // 合并数据，保留已有数据，用新数据覆盖
          state.manga[item.hash] = {
            ...defaultIncreaseManga,
            ...state.manga[item.hash],
            ...item,
          };
        });
      })
      // 加载漫画完成时，更新漫画字典
      .addCase(mangaAction.loadMangaCompletion, (state, action) => {
        const { error, data } = action.payload;
        if (error || !data) {
          return;
        }

        // 合并数据，保留已有数据，用新数据覆盖
        state.manga[data.hash] = {
          ...defaultIncreaseManga,
          ...state.manga[data.hash],
          ...data,
        };
      })
      // 开始加载章节时，清空旧数据（避免显示过期数据）
      .addCase(
        chapterAction.loadChapter,
        (state, action: PayloadAction<{ chapterHash: string }>) => {
          delete state.chapter[action.payload.chapterHash];
        }
      )
      // 加载章节完成时，更新章节字典
      .addCase(chapterAction.loadChapterCompletion, (state, action) => {
        const { error, data } = action.payload;
        if (error || !data) {
          return;
        }

        // 合并数据，保留已有数据，用新数据覆盖
        state.chapter[data.hash] = { ...state.chapter[data.hash], ...data };
      })
      // 清空缓存时重置字典
      .addCase(datasyncAction.clearCache, () => {
        return initialState.dict;
      });
  },
});

// ==================== 导出 Actions 和 Reducers ====================

/**
 * 导出所有 action creators
 */
const appAction = appSlice.actions;
const datasyncAction = datasyncSlice.actions;
const releaseAction = releaseSlice.actions;
const settingAction = settingSlice.actions;
const pluginAction = pluginSlice.actions;
const batchAction = batchSlice.actions;
const searchAction = searchSlice.actions;
const discoveryAction = discoverySlice.actions;
const favoritesAction = favoritesSlice.actions;
const mangaAction = mangaSlice.actions;
const chapterAction = chapterSlice.actions;
const missionAction = missionSlice.actions;
const dictAction = dictSlice.actions;

/**
 * 导出所有 reducers
 */
const appReducer = appSlice.reducer;
const datasyncReducer = datasyncSlice.reducer;
const releaseReducer = releaseSlice.reducer;
const settingReducer = settingSlice.reducer;
const pluginReducer = pluginSlice.reducer;
const batchReducer = batchSlice.reducer;
const searchReducer = searchSlice.reducer;
const discoveryReducer = discoverySlice.reducer;
const favoritesReducer = favoritesSlice.reducer;
const mangaReducer = mangaSlice.reducer;
const chapterReducer = chapterSlice.reducer;
const missionReducer = missionSlice.reducer;
const dictReducer = dictSlice.reducer;

/**
 * 合并所有 action creators
 * 方便统一导入使用
 */
export const action = {
  ...appAction,
  ...datasyncAction,
  ...releaseAction,
  ...settingAction,
  ...pluginAction,
  ...batchAction,
  ...searchAction,
  ...discoveryAction,
  ...favoritesAction,
  ...mangaAction,
  ...chapterAction,
  ...missionAction,
  ...dictAction,
};

/**
 * 合并所有 reducers
 * 使用 combineReducers 将各个 slice 的 reducer 合并成根 reducer
 */
export const reducer = combineReducers<RootState>({
  app: appReducer,
  datasync: datasyncReducer,
  release: releaseReducer,
  setting: settingReducer,
  plugin: pluginReducer,
  batch: batchReducer,
  search: searchReducer,
  discovery: discoveryReducer,
  favorites: favoritesReducer,
  manga: mangaReducer,
  chapter: chapterReducer,
  task: missionReducer,
  dict: dictReducer,
});
