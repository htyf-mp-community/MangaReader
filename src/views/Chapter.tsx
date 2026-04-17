/**
 * 漫画阅读器 - 章节页面组件
 * 
 * 主要功能：
 * 1. 支持多种阅读模式（横向翻页、纵向滚动、双页模式）
 * 2. 支持阅读方向切换（从左到右、从右到左）
 * 3. 支持亮度切换（日间/夜间模式）
 * 4. 支持音量键翻页、定时自动翻页
 * 5. 支持图片保存、章节导航
 * 6. 支持图片缓存管理
 * 
 * @module Chapter
 */

import React, { useRef, useMemo, useState, useCallback, Fragment } from 'react';
import {
  AsyncStatus,
  Volume,
  LayoutMode,
  LightSwitch,
  ReaderDirection,
  PositionX,
  Orientation,
  ScrambleType,
  MultipleSeat,
  Hearing,
  Timer,
  Animated,
} from '@/utils';
import Cache from '@/utils/cache';
import {
  Box,
  Text,
  Flex,
  Center,
  HStack,
  Stagger,
  StatusBar,
  useToast,
  useDisclose,
} from 'native-base';
import { usePrevNext, useVolumeUpDown, useDebouncedSafeAreaFrame, useInterval } from '@/hooks';
import { action, useAppSelector, useAppDispatch } from '@/redux';
import { useFocusEffect } from '@react-navigation/native';
import PageSlider, { PageSliderRef } from '@/components/PageSlider';
import Reader, { ReaderRef } from '@/components/Reader';
import ActionsheetSelect from '@/components/ActionsheetSelect';
import ErrorWithRetry from '@/components/ErrorWithRetry';
import SpinLoading from '@/components/SpinLoading';
import InputModal from '@/components/InputModal';
import VectorIcon from '@/components/VectorIcon';
import Empty from '@/components/Empty';

// ==================== Redux Actions ====================
const {
  loadChapter,
  viewChapter,
  viewPage,
  viewImage,
  setMode,
  setDirection,
  setLight,
  setSeat,
  setHearing,
  setTimer,
  setTimerGap,
  setAnimated,
  saveImage,
} = action;

// ==================== 常量定义 ====================
/** 最后一页提示的 Toast ID，用于防止重复提示 */
const lastPageToastId = 'LAST_PAGE_TOAST_ID';

/** 图片操作选项 */
const ImageSelectOptions = [{ label: '保存图片', value: 'save' }];

/** 布局模式对应的图标映射 */
const layoutIconDict = {
  [LayoutMode.Horizontal]: 'book-open-page-variant-outline', // 横向翻页模式
  [LayoutMode.Vertical]: 'filmstrip', // 纵向滚动模式（条漫）
  [LayoutMode.Multiple]: 'book-open-outline', // 双页模式
};

// ==================== 自定义 Hooks ====================

/**
 * 将多个章节的图片列表扁平化处理
 * 
 * 功能说明：
 * - 将多个章节的图片合并成一个扁平列表
 * - 计算每个图片的前置索引（pre）和双页模式前置索引（multiplePre）
 * - 为每个图片添加章节哈希和当前索引信息
 * 
 * @param hashList - 章节哈希列表
 * @param dict - 章节字典数据
 * @returns 扁平化的图片列表，包含位置信息
 */
const useChapterFlat = (hashList: string[], dict: RootState['dict']['chapter']) => {
  return useMemo(() => {
    const list: {
      uri: string;
      scrambleType?: ScrambleType;
      needUnscramble?: boolean | undefined;
      pre: number; // 当前图片在所有图片中的前置数量
      multiplePre: number; // 双页模式下的前置数量
      current: number; // 当前图片在章节中的索引（从1开始）
      chapterHash: string; // 所属章节的哈希
      isBase64Image?: boolean;
    }[] = [];

    hashList.forEach((hash) => {
      const chapter = dict[hash];
      const images = chapter?.images || [];
      const pre = list?.length; // 当前章节开始前的图片总数
      
      // 计算双页模式下的前置数量
      // 双页模式下，每两页合并为一页显示
      const multiplePre =
        list?.length > 0
          ? list[list?.length - 1].multiplePre + Math.ceil(list[list?.length - 1].current / 2)
          : 0;
      
      // 将当前章节的图片添加到列表中
      images.forEach((item, index) =>
        list.push({ ...item, pre, multiplePre, current: index + 1, chapterHash: hash })
      );
    });

    return list;
  }, [hashList, dict]);
};

/**
 * 章节阅读页面主组件
 * 
 * @param route - 路由参数，包含 mangaHash、chapterHash、page
 * @param navigation - 导航对象
 */
const Chapter = ({ route, navigation }: StackChapterProps) => {
  // ==================== 路由参数解析 ====================
  const { mangaHash, chapterHash: initChapterHash, page: initPage } = route.params || {};

  // ==================== Hooks 初始化 ====================
  const toast = useToast();
  const dispatch = useAppDispatch();
  
  // 图片操作菜单控制
  const { isOpen, onOpen, onClose } = useDisclose();
  
  // 设置菜单展开/收起控制
  const { isOpen: isStaggerOpen, onOpen: onStaggerOpen, onClose: onStaggerClose } = useDisclose();
  
  // 定时翻页间隔设置弹窗控制
  const {
    isOpen: isTimerGapOpen,
    onOpen: onTimerGapOpen,
    onClose: onTimerGapClose,
  } = useDisclose();

  // ==================== 组件状态 ====================
  /** 当前显示的图片索引（从0开始） */
  const [page, setPage] = useState(initPage - 1);
  
  /** 是否显示顶部和底部控制栏 */
  const [showExtra, setShowExtra] = useState(false);
  
  /** 定时翻页开关（滚动或缩放时自动关闭） */
  const [timerSwitch, setTimerSwitch] = useState(true);
  
  /** 当前章节哈希 */
  const [chapterHash, setChapterHash] = useState(initChapterHash);
  
  /** 已加载的章节哈希列表（用于多章节连续阅读） */
  const [hashList, setHashList] = useState([initChapterHash]);

  // ==================== Redux 状态选择 ====================
  /** 屏幕方向 */
  const { orientation } = useDebouncedSafeAreaFrame();
  
  /** 章节加载状态 */
  const loadStatus = useAppSelector((state) => state.chapter.loadStatus);
  
  /** 双页模式下的阅读顺序 */
  const seat = useAppSelector((state) => state.setting.seat);
  
  /** 布局模式（横向/纵向/双页） */
  const mode = useAppSelector((state) => state.setting.mode);
  
  /** 亮度模式（日间/夜间） */
  const light = useAppSelector((state) => state.setting.light);
  
  /** 定时翻页开关 */
  const timer = useAppSelector((state) => state.setting.timer);
  
  /** 定时翻页间隔（毫秒） */
  const timerGap = useAppSelector((state) => state.setting.timerGap);
  
  /** 翻页动画开关 */
  const animated = useAppSelector((state) => state.setting.animated);
  
  /** 音量键翻页开关 */
  const hearing = useAppSelector((state) => state.setting.hearing);
  
  /** 阅读方向（从左到右/从右到左） */
  const direction = useAppSelector((state) => state.setting.direction);
  
  /** 漫画字典数据 */
  const mangaDict = useAppSelector((state) => state.dict.manga);
  
  /** 章节字典数据 */
  const chapterDict = useAppSelector((state) => state.dict.chapter);

  // ==================== 计算属性 ====================
  /** 
   * 是否反转阅读方向
   * 仅在横向和双页模式下，且方向为从右到左时反转
   */
  const inverted = useMemo(
    () => mode !== LayoutMode.Vertical && direction === ReaderDirection.Left,
    [mode, direction]
  );
  
  /** 当前漫画的章节列表 */
  const chapterList = useMemo(() => mangaDict[mangaHash]?.chapters || [], [mangaDict, mangaHash]);
  
  /** 扁平化后的图片列表 */
  const data = useChapterFlat(hashList, chapterDict);
  
  /** 当前图片的位置信息 */
  const { pre, current, multiplePre } = useMemo(
    () => data[page] || { pre: 0, current: 0, multiplePre: 0 },
    [page, data]
  );
  
  /** 当前章节的基本信息 */
  const { title, headers, max } = useMemo(() => {
    const chapter = chapterDict[chapterHash];
    return {
      title: chapter?.title || '',
      headers: chapter?.headers || {},
      max: (chapter?.images || [])?.length,
    };
  }, [chapterDict, chapterHash]);
  
  /** 主题颜色配置 */
  const { lightOn, color, bg } = useMemo(
    () => ({
      lightOn: light === LightSwitch.On,
      color: light === LightSwitch.On ? 'black' : 'white',
      bg: light === LightSwitch.On ? 'white' : 'black',
    }),
    [light]
  );
  
  /** 上一章/下一章信息 */
  const [prev, next] = usePrevNext(chapterList, chapterHash);
  
  /** 更多章节信息（用于加载更多） */
  const [, more] = usePrevNext(chapterList, hashList[hashList?.length - 1]);

  // ==================== Refs ====================
  /** 阅读器组件引用 */
  const readerRef = useRef<ReaderRef>(null);
  
  /** 页面滑块组件引用 */
  const pageSliderRef = useRef<PageSliderRef>(null);
  
  /** 音量键回调函数引用 */
  const callbackRef = useRef<((type: Volume) => void) | undefined>(undefined);
  
  /** 当前长按的图片源地址 */
  const sourceRef = useRef('');
  
  /** 是否完成初始化渲染 */
  const [render, setRender] = useState(false);
  
  /** 图片缓存管理器 */
  const cache = useMemo(() => new Cache(mangaHash), [mangaHash]);

  // ==================== 音量键回调函数 ====================
  /**
   * 音量键事件处理
   * 音量下键：下一页
   * 音量上键：上一页
   */
  callbackRef.current = (type) => {
    if (type === Volume.Down) {
      handleNextPage();
    }
    if (type === Volume.Up) {
      handlePrevPage();
    }
  };

  // ==================== 生命周期 Hooks ====================
  
  /**
   * 页面获得焦点时，记录当前查看的章节
   */
  useFocusEffect(
    useCallback(() => {
      dispatch(viewChapter({ mangaHash, chapterHash, chapterTitle: title }));
    }, [dispatch, mangaHash, chapterHash, title])
  );
  
  /**
   * 页面获得焦点时，如果章节数据为空则加载
   */
  useFocusEffect(
    useCallback(() => {
      if (data?.length <= 0) {
        dispatch(loadChapter({ chapterHash }));
      }
    }, [dispatch, chapterHash, data?.length])
  );
  
  /**
   * 当前页变化时，记录查看的页面
   */
  useFocusEffect(
    useCallback(() => {
      dispatch(viewPage({ mangaHash, page: current }));
    }, [current, dispatch, mangaHash])
  );
  
  /**
   * 初始化缓存映射
   * 在页面显示时初始化，页面隐藏时保存
   */
  const init = useCallback(async () => {
    setRender(false);
    try {
      await cache.initCacheMap();
    } catch (error) {
      // 缓存初始化失败不影响阅读，静默处理
    } finally {
      setRender(true);
    }
  }, [cache]);
  
  useFocusEffect(
    useCallback(() => {
      init();
      return () => {
        // 页面隐藏时保存缓存映射
        cache.storeCacheMap();
      };
    }, [init, cache])
  );
  
  /**
   * 音量键翻页监听
   * 仅在启用音量翻页时生效
   */
  useVolumeUpDown(
    useCallback((type) => callbackRef.current && callbackRef.current(type), []),
    hearing === Hearing.Enable
  );
  
  /**
   * 定时自动翻页
   * 仅在启用定时翻页且未在滚动/缩放时生效
   */
  useInterval(
    useCallback(() => callbackRef.current && callbackRef.current(Volume.Down), []),
    timer === Timer.Enable && timerSwitch,
    timerGap
  );

  // ==================== 页面导航处理 ====================
  
  /**
   * 上一页处理
   * 根据布局模式计算目标页面索引
   */
  const handlePrevPage = useCallback(() => {
    if (mode !== LayoutMode.Multiple) {
      // 横向和纵向模式：直接减1
      readerRef.current?.scrollToIndex(Math.max(page - 1, 0), animated === Animated.Enable);
    } else {
      // 双页模式：每两页合并为一页，需要特殊计算
      readerRef.current?.scrollToIndex(
        Math.max(multiplePre + Math.ceil(current / 2) - 2, 0),
        animated === Animated.Enable
      );
    }
  }, [mode, page, multiplePre, current, animated]);
  
  /**
   * 下一页处理
   * 根据布局模式计算目标页面索引
   */
  const handleNextPage = useCallback(() => {
    if (mode !== LayoutMode.Multiple) {
      // 横向和纵向模式：直接加1
      readerRef.current?.scrollToIndex(
        Math.min(page + 1, Math.max(data?.length - 1, 0)),
        animated === Animated.Enable
      );
    } else {
      // 双页模式：计算双页模式下的最大索引
      const multipleMax = data[data?.length - 1].multiplePre + data[data?.length - 1].current;
      readerRef.current?.scrollToIndex(
        Math.min(multiplePre + Math.ceil(current / 2), Math.max(multipleMax - 1, 0)),
        animated === Animated.Enable
      );
    }
  }, [mode, page, data, multiplePre, current, animated]);
  /**
   * 上一章处理
   * 切换到上一章并重置到第一页
   */
  const handlePrevChapter = useCallback(() => {
    if (prev) {
      setChapterHash(prev.hash);
      setHashList([prev.hash]);
      setPage(0);
      pageSliderRef.current?.changePage(1);
      readerRef.current?.clearStateRef();
      readerRef.current?.scrollToIndex(0, false);
    } else {
      toast.show({ title: '第一话' });
    }
  }, [prev, toast]);
  
  /**
   * 下一章处理
   * 切换到下一章并重置到第一页
   */
  const handleNextChapter = useCallback(() => {
    if (next) {
      setChapterHash(next.hash);
      setHashList([next.hash]);
      setPage(0);
      pageSliderRef.current?.changePage(1);
      readerRef.current?.clearStateRef();
      readerRef.current?.scrollToIndex(0, false);
    } else {
      toast.show({ title: '最后一话' });
    }
  }, [next, toast]);
  
  /**
   * 点击事件处理
   * 
   * 点击位置说明：
   * - 中间：显示/隐藏控制栏
   * - 左右：根据阅读方向翻页
   * 
   * @param position - 点击位置（左/中/右）
   */
  const handleTap = useCallback((position: PositionX) => {
    if (position === PositionX.Mid) {
      // 中间点击：切换控制栏显示状态
      setShowExtra((prev) => {
        const newState = !prev;
        // 隐藏控制栏时，同时关闭设置菜单
        if (!newState) {
          onStaggerClose();
        }
        return newState;
      });
    }
    
    // 左右点击：根据阅读方向翻页
    if (inverted) {
      // 反转模式：右=上一页，左=下一页
      if (position === PositionX.Right) {
        handlePrevPage();
      }
      if (position === PositionX.Left) {
        handleNextPage();
      }
    } else {
      // 正常模式：左=上一页，右=下一页
      if (position === PositionX.Left) {
        handlePrevPage();
      }
      if (position === PositionX.Right) {
        handleNextPage();
      }
    }
  }, [inverted, handlePrevPage, handleNextPage, onStaggerClose]);
  
  /**
   * 长按事件处理
   * 
   * 长按位置说明：
   * - 中间：打开图片操作菜单（保存图片）
   * - 左右：根据阅读方向切换章节
   * 
   * @param position - 长按位置（左/中/右）
   * @param source - 图片源地址（用于保存）
   */
  const handleLongPress = useCallback((position: PositionX, source?: string) => {
    if (position === PositionX.Mid) {
      // 中间长按：打开图片操作菜单
      sourceRef.current = source || '';
      onOpen();
    }
    
    // 左右长按：根据阅读方向切换章节
    if (inverted) {
      // 反转模式：右=上一章，左=下一章
      if (position === PositionX.Right) {
        handlePrevChapter();
      }
      if (position === PositionX.Left) {
        handleNextChapter();
      }
    } else {
      // 正常模式：左=上一章，右=下一章
      if (position === PositionX.Left) {
        handlePrevChapter();
      }
      if (position === PositionX.Right) {
        handleNextChapter();
      }
    }
  }, [inverted, handlePrevChapter, handleNextChapter, onOpen]);
  
  /**
   * 图片加载完成回调
   * 记录用户查看的图片
   */
  const handleImageLoad = useCallback((_uri: string, hash: string, index: number) => {
    dispatch(viewImage({ chapterHash: hash, index }));
  }, [dispatch]);
  
  /**
   * 页面变化回调
   * 更新当前章节、页面索引和滑块位置
   * 
   * @param newPage - 新的页面索引
   */
  const handlePageChange = useCallback((newPage: number) => {
    const image = data[newPage];
    if (!image) return;
    
    // 到达最后一页且没有下一章时，显示提示
    if (newPage >= data?.length - 1 && !next && !toast.isActive(lastPageToastId)) {
      toast.show({ id: lastPageToastId, title: '最后一页' });
    }

    setChapterHash(image.chapterHash);
    setPage(newPage);
    pageSliderRef.current?.changePage(image.current);
  }, [data, next, toast]);
  
  /**
   * 加载更多章节
   * 用于连续阅读模式，自动加载下一章
   */
  const handleLoadMore = useCallback(() => {
    if (more && !hashList.includes(more.hash)) {
      setHashList((prev) => [...prev, more.hash]);
      // 如果章节数据未加载，则发起加载请求
      if (!chapterDict[more.hash]) {
        dispatch(loadChapter({ chapterHash: more.hash }));
      }
    }
  }, [more, hashList, chapterDict, dispatch]);

  // ==================== 图片操作处理 ====================
  
  /**
   * 保存图片
   * 保存当前长按的图片到相册
   */
  const handleImageSave = useCallback(() => {
    if (sourceRef.current !== '') {
      dispatch(saveImage({ source: sourceRef.current, headers }));
      onClose(); // 关闭菜单
    } else {
      toast.show({ title: '保存失败' });
    }
  }, [dispatch, headers, toast, onClose]);

  // ==================== 导航处理 ====================
  
  /**
   * 返回上一页
   */
  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);
  
  /**
   * 重新加载当前章节
   */
  const handleReload = useCallback(() => {
    setChapterHash(chapterHash);
    setHashList([chapterHash]);
    readerRef.current?.clearStateRef();
    dispatch(loadChapter({ chapterHash }));
  }, [chapterHash, dispatch]);

  // ==================== 设置项切换处理 ====================
  
  /**
   * 双页模式顺序切换
   * AToB: 从左向右（A页在前，B页在后）
   * BToA: 从右向左（B页在前，A页在后）
   */
  const handleSeatToggle = useCallback(() => {
    if (seat === MultipleSeat.AToB) {
      toast.show({ title: '双页漫画顺序: 从右向左' });
      dispatch(setSeat(MultipleSeat.BToA));
    } else {
      toast.show({ title: '双页漫画顺序: 从左向右' });
      dispatch(setSeat(MultipleSeat.AToB));
    }
  }, [seat, dispatch, toast]);
  
  /**
   * 音量键翻页开关切换
   */
  const handleHearingToggle = useCallback(() => {
    if (hearing === Hearing.Enable) {
      toast.show({ title: '已关闭音量翻页' });
      dispatch(setHearing(Hearing.Disabled));
    } else {
      toast.show({ title: '已开启音量翻页' });
      dispatch(setHearing(Hearing.Enable));
    }
  }, [hearing, dispatch, toast]);
  
  /**
   * 定时翻页开关切换
   */
  const handleTimerToggle = useCallback(() => {
    if (timer === Timer.Enable) {
      toast.show({ title: '已关闭定时翻页' });
      dispatch(setTimer(Timer.Disabled));
    } else {
      toast.show({ title: `已开启定时翻页，间隔${(timerGap / 1000).toFixed(1)}s` });
      dispatch(setTimer(Timer.Enable));
    }
  }, [timer, timerGap, dispatch, toast]);
  
  /**
   * 翻页动画开关切换
   */
  const handleAnimatedToggle = useCallback(() => {
    if (animated === Animated.Enable) {
      toast.show({ title: '已关闭翻页动画' });
      dispatch(setAnimated(Animated.Disabled));
    } else {
      toast.show({ title: '已开启翻页动画' });
      dispatch(setAnimated(Animated.Enable));
    }
  }, [animated, dispatch, toast]);
  
  /**
   * 屏幕方向切换
   * 竖屏 ↔ 横屏
   */
  const handleOrientationToggle = useCallback(() => {
    navigation.setOptions({
      orientation: orientation === Orientation.Portrait ? 'landscape_right' : 'portrait',
    });
  }, [navigation, orientation]);
  
  /**
   * 亮度模式切换
   * 日间模式 ↔ 夜间模式
   */
  const handleLightToggle = useCallback(() => {
    dispatch(setLight(lightOn ? LightSwitch.Off : LightSwitch.On));
  }, [lightOn, dispatch]);
  
  /**
   * 阅读方向切换
   * 从左向右 ↔ 从右向左
   */
  const handleDirectionToggle = useCallback(() => {
    if (inverted) {
      toast.show({ title: '阅读方向: 从左向右' });
      dispatch(setDirection(ReaderDirection.Right));
    } else {
      toast.show({ title: '阅读方向: 从右向左' });
      dispatch(setDirection(ReaderDirection.Left));
    }
  }, [inverted, dispatch, toast]);
  
  /**
   * 布局模式循环切换
   * 横向翻页 → 纵向滚动 → 双页模式 → 横向翻页
   */
  const handleModeToggle = useCallback(() => {
    switch (mode) {
      case LayoutMode.Horizontal: {
        handleVertical();
        break;
      }
      case LayoutMode.Vertical: {
        handleMultiple();
        break;
      }
      case LayoutMode.Multiple:
      default: {
        handleHorizontal();
        break;
      }
    }
  }, [mode]);
  
  /**
   * 切换到纵向滚动模式（条漫模式）
   */
  const handleVertical = useCallback(() => {
    toast.show({ title: '条漫模式' });
    readerRef.current?.scrollToIndex(page, false);
    dispatch(setMode(LayoutMode.Vertical));
  }, [page, dispatch, toast]);
  
  /**
   * 切换到横向翻页模式
   */
  const handleHorizontal = useCallback(() => {
    toast.show({ title: '翻页模式' });
    dispatch(setMode(LayoutMode.Horizontal));
  }, [dispatch, toast]);
  
  /**
   * 切换到双页模式
   */
  const handleMultiple = useCallback(() => {
    toast.show({ title: '双页模式' });
    readerRef.current?.scrollToIndex(multiplePre + Math.ceil(current / 2) - 1, false);
    dispatch(setMode(LayoutMode.Multiple));
  }, [multiplePre, current, dispatch, toast]);
  
  /**
   * 打开定时翻页间隔设置弹窗
   * 打开前先关闭定时翻页，避免设置过程中继续翻页
   */
  const handleTimerGapOpen = useCallback(() => {
    dispatch(setTimer(Timer.Disabled));
    onTimerGapOpen();
  }, [dispatch, onTimerGapOpen]);
  
  /**
   * 关闭定时翻页间隔设置弹窗
   * 验证输入的间隔值（最小500ms）
   * 
   * @param value - 输入的间隔值（毫秒）
   */
  const handleTimerGapClose = useCallback((value: string) => {
    const gap = Number(value);

    if (gap >= 500) {
      dispatch(setTimerGap(gap));
      onTimerGapClose();
    } else {
      toast.show({ title: '间隔不能低于500ms' });
    }
  }, [dispatch, toast, onTimerGapClose]);
  
  /**
   * 滑块拖动结束处理
   * 根据滑块值跳转到对应页面
   * 
   * @param newStep - 滑块的新值（从1开始）
   */
  const handleSliderChangeEnd = useCallback((newStep: number) => {
    const newPage = pre + Math.floor(newStep - 1);
    const multiplePage = multiplePre + Math.floor((newStep - 1) / 2);
    
    // 接近末尾时，自动加载更多章节
    if (newStep > max - 5) {
      handleLoadMore();
    }
    
    setPage(newPage);
    readerRef.current?.scrollToIndex(
      mode !== LayoutMode.Multiple ? newPage : multiplePage,
      false
    );
  }, [pre, multiplePre, max, mode, handleLoadMore]);

  // ==================== 加载状态渲染 ====================
  
  /**
   * 数据为空时的状态渲染
   * 根据加载状态显示不同的UI
   */
  if (data?.length <= 0) {
    if (loadStatus === AsyncStatus.Pending) {
      // 加载中：显示加载动画
      return (
        <Center w="full" h="full" bg={bg}>
          <SpinLoading color={color} />
        </Center>
      );
    }
    if (loadStatus === AsyncStatus.Fulfilled) {
      // 加载完成但数据为空：显示空状态提示
      return <Empty bg={bg} color={color} text="该章节是空的" onPress={handleReload} />;
    }
    if (loadStatus === AsyncStatus.Rejected) {
      // 加载失败：显示错误提示和重试按钮
      return (
        <Center w="full" h="full" bg={bg}>
          <ErrorWithRetry color={color} onRetry={handleReload} />
        </Center>
      );
    }
  }

  // ==================== 主界面渲染 ====================
  
  return (
    <Box w="full" h="full" bg={bg}>
      {/* 状态栏配置 */}
      <StatusBar
        backgroundColor={bg}
        hidden={!showExtra} // 控制栏显示时显示状态栏
        barStyle={
          showExtra
            ? lightOn
              ? 'dark-content' // 日间模式：深色内容
              : 'light-content' // 夜间模式：浅色内容
            : lightOn
            ? 'light-content' // 隐藏控制栏时，日间模式用浅色（与背景对比）
            : 'dark-content' // 隐藏控制栏时，夜间模式用深色（与背景对比）
        }
      />
      
      {/* 阅读器组件 */}
      {/* 仅在缓存初始化完成后渲染，避免闪烁 */}
      {render && (
        <Reader
          key={orientation} // 屏幕方向变化时重新渲染
          ref={readerRef}
          data={data}
          headers={headers}
          initPage={page}
          inverted={inverted}
          seat={seat}
          layoutMode={mode}
          onTap={handleTap}
          onLongPress={handleLongPress}
          onImageLoad={handleImageLoad}
          onPageChange={handlePageChange}
          onLoadMore={handleLoadMore}
          // 滚动开始时暂停定时翻页
          onScrollBeginDrag={() => setTimerSwitch(false)}
          // 滚动结束时恢复定时翻页
          onScrollEndDrag={() => setTimerSwitch(true)}
          // 缩放开始时，如果缩放比例>1则暂停定时翻页
          onZoomStart={(scale) => setTimerSwitch(scale <= 1)}
          // 缩放结束时，如果缩放比例>1则暂停定时翻页
          onZoomEnd={(scale) => setTimerSwitch(scale <= 1)}
          cache={cache}
        />
      )}
      {/* 图片操作菜单（长按图片时显示） */}
      <ActionsheetSelect
        isOpen={isOpen}
        onClose={onClose}
        options={ImageSelectOptions}
        onChange={(value) => {
          if (value === 'save') {
            handleImageSave();
          }
        }}
      />
      
      {/* 定时翻页间隔设置弹窗 */}
      <InputModal
        title="自动翻页间隔："
        rightAddon="ms"
        isOpen={isTimerGapOpen}
        keyboardType="number-pad"
        defaultValue={timerGap.toString()}
        onClose={handleTimerGapClose}
      />

      {/* 控制栏（顶部和底部） */}
      {showExtra && (
        <Fragment>
          {/* ==================== 顶部控制栏 ==================== */}
          <Box
            position="absolute"
            top={'40px'}
            left={0}
            right={0}
            safeAreaTop
            safeAreaLeft
            safeAreaRight
          >
            <Flex position="relative" flexDirection="row" alignItems="center">
              {/* 返回按钮 */}
              <VectorIcon
                name="arrow-back"
                size="2xl"
                shadow="icon"
                color={color}
                onPress={handleGoBack}
              />
              
              {/* 章节标题 */}
              <Text
                flexShrink={1}
                shadow="icon"
                fontSize="md"
                fontWeight="bold"
                numberOfLines={1}
                color={color}
              >
                {title}
              </Text>
              
              {/* 重新加载按钮 */}
              <VectorIcon
                name="replay"
                size="md"
                shadow="icon"
                color={color}
                onPress={handleReload}
              />

              {/* 弹性空间 */}
              <Box w={0} flexGrow={1} />

              {/* 屏幕方向切换 */}
              <VectorIcon
                name={
                  orientation === Orientation.Portrait
                    ? 'stay-primary-portrait'
                    : 'stay-primary-landscape'
                }
                size="lg"
                shadow="icon"
                color={color}
                onPress={handleOrientationToggle}
              />
              
              {/* 亮度切换 */}
              <VectorIcon
                name="lightbulb"
                size="lg"
                shadow="icon"
                color={color}
                onPress={handleLightToggle}
              />
              
              {/* 页面进度显示 */}
              <Text shadow="icon" px={1} color={color} fontWeight="bold">
                {current} / {max}
              </Text>
              
              {/* 设置菜单展开/收起按钮 */}
              <VectorIcon
                name="dots-horizontal"
                size="lg"
                shadow="icon"
                source="materialCommunityIcons"
                color={color}
                onPress={isStaggerOpen ? onStaggerClose : onStaggerOpen}
              />

              {/* ==================== 设置菜单（展开动画） ==================== */}
              <Box position="absolute" right={0} top="100%">
                <Stagger visible={isStaggerOpen} initial={{ opacity: 0, scale: 0 }}>
                  <HStack>
                    {/* 布局模式切换 */}
                    <VectorIcon
                      name={layoutIconDict[mode]}
                      size="lg"
                      shadow="icon"
                      source="materialCommunityIcons"
                      color={color}
                      onPress={handleModeToggle}
                    />
                    
                    {/* 阅读方向切换（仅在横向和双页模式显示） */}
                    {mode !== LayoutMode.Vertical ? (
                      <VectorIcon
                        name={inverted ? 'west' : 'east'}
                        size="lg"
                        shadow="icon"
                        color={color}
                        onPress={handleDirectionToggle}
                      />
                    ) : (
                      <Box /> // 占位符，保持布局一致
                    )}
                    
                    {/* 双页顺序切换（仅在双页模式显示） */}
                    {mode === LayoutMode.Multiple ? (
                      <VectorIcon
                        name={
                          seat === MultipleSeat.AToB
                            ? 'format-letter-starts-with' // A→B：从左向右
                            : 'format-letter-ends-with' // B→A：从右向左
                        }
                        size="lg"
                        source="materialCommunityIcons"
                        shadow="icon"
                        color={color}
                        onPress={handleSeatToggle}
                      />
                    ) : (
                      <Box /> // 占位符，保持布局一致
                    )}
                    
                    {/* 音量键翻页开关 */}
                    <VectorIcon
                      name={hearing === Hearing.Enable ? 'earbuds-outline' : 'earbuds-off-outline'}
                      size="lg"
                      shadow="icon"
                      source="materialCommunityIcons"
                      color={color}
                      onPress={handleHearingToggle}
                    />
                    
                    {/* 定时翻页开关 */}
                    {/* 点击：开关定时翻页，长按：设置间隔 */}
                    <VectorIcon
                      name={timer === Timer.Enable ? 'timer-outline' : 'timer-off-outline'}
                      size="lg"
                      shadow="icon"
                      source="materialCommunityIcons"
                      color={color}
                      onPress={handleTimerToggle}
                      onLongPress={handleTimerGapOpen}
                    />
                    
                    {/* 翻页动画开关 */}
                    <VectorIcon
                      name={
                        animated === Animated.Enable
                          ? 'arrow-left-right-bold' // 启用：显示动画图标
                          : 'arrow-horizontal-lock' // 禁用：显示锁定图标
                      }
                      size="lg"
                      shadow="icon"
                      source="materialCommunityIcons"
                      color={color}
                      onPress={handleAnimatedToggle}
                    />
                  </HStack>
                </Stagger>
              </Box>
            </Flex>
          </Box>

          {/* ==================== 底部控制栏 ==================== */}
          <Flex
            position="absolute"
            left={0}
            right={0}
            bottom={0}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            safeAreaX
            safeAreaBottom
          >
            {/* 上一章按钮（如果存在） */}
            {prev ? (
              <VectorIcon
                name="skip-previous"
                size="lg"
                shadow="icon"
                color={color}
                onPress={handlePrevChapter}
              />
            ) : (
              <Box w={45} /> // 占位符，保持布局居中
            )}
            
            {/* 页面进度滑块 */}
            <PageSlider
              mx={1}
              flex={1}
              ref={pageSliderRef}
              max={max}
              defaultValue={current}
              onSliderChangeEnd={handleSliderChangeEnd}
            />
            
            {/* 下一章按钮（如果存在） */}
            {next ? (
              <VectorIcon
                name="skip-next"
                size="lg"
                shadow="icon"
                color={color}
                onPress={handleNextChapter}
              />
            ) : (
              <Box w={45} /> // 占位符，保持布局居中
            )}
          </Flex>
        </Fragment>
      )}
    </Box>
  );
};

export default Chapter;
