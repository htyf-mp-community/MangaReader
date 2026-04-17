/**
 * 漫画阅读器核心组件
 * 
 * 主要功能：
 * 1. 支持三种阅读模式：
 *    - 横向翻页模式（Horizontal）：左右滑动翻页，适合单页漫画
 *    - 纵向滚动模式（Vertical）：上下滚动，适合条漫
 *    - 双页模式（Multiple）：左右滑动，每页显示两张图片，适合双页漫画
 * 2. 支持阅读方向反转（从左到右 ↔ 从右到左）
 * 3. 支持图片缩放、点击、长按操作
 * 4. 支持图片状态缓存，提升滚动性能
 * 5. 支持自动加载更多章节
 * 
 * 性能优化：
 * - 使用 FlashList 实现虚拟滚动，支持大量图片的高性能渲染
 * - 使用 ref 存储图片状态，避免不必要的重渲染
 * - 使用 memo 和 useMemo 优化渲染性能
 * 
 * @module Reader
 */

import React, {
  memo,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
  forwardRef,
  ForwardRefRenderFunction,
} from 'react';
import {
  getDefaultFillMedianHeight,
  LayoutMode,
  PositionX,
  ScrambleType,
  MultipleSeat,
  SafeArea,
  Orientation,
} from '@/utils';
import { FlashList, ListRenderItemInfo, ViewToken } from '@shopify/flash-list';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useDebouncedSafeAreaFrame } from '@/hooks';
import { useFocusEffect } from '@react-navigation/native';
import { Box, Flex } from 'native-base';
import Controller, { LongPressController } from '@/components/Controller';
import ComicImage, { ImageState } from '@/components/ComicImage';
import Cache from '@/utils/cache';

// ==================== 类型定义 ====================

/**
 * Reader 组件属性接口
 */
export interface ReaderProps {
  /** 初始页面索引（从0开始） */
  initPage?: number;
  
  /** 是否反转滚动方向（用于从右到左阅读） */
  inverted?: boolean;
  
  /** 双页模式下的阅读顺序 */
  seat?: MultipleSeat;
  
  /** 布局模式 */
  layoutMode?: LayoutMode;
  
  /** 图片数据列表 */
  data?: {
    uri: string; // 图片 URL
    scrambleType?: ScrambleType; // 图片加密类型
    needUnscramble?: boolean | undefined; // 是否需要解密
    pre: number; // 前置图片数量
    current: number; // 当前图片在章节中的索引（从1开始）
    chapterHash: string; // 所属章节的哈希
    isBase64Image?: boolean; // 是否为 Base64 图片
  }[];
  
  /** HTTP 请求头 */
  headers?: Chapter['headers'];
  
  /** 点击事件回调 */
  onTap?: (position: PositionX) => void;
  
  /** 长按事件回调 */
  onLongPress?: (position: PositionX, source?: string) => void;
  
  /** 图片加载完成回调 */
  onImageLoad?: (uri: string, hash: string, index: number) => void;
  
  /** 页面变化回调 */
  onPageChange?: (page: number) => void;
  
  /** 加载更多回调（滚动到底部时触发） */
  onLoadMore?: () => void;
  
  /** 缩放开始回调 */
  onZoomStart?: (scale: number) => void;
  
  /** 缩放结束回调 */
  onZoomEnd?: (scale: number) => void;
  
  /** 滚动事件回调 */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  
  /** 开始拖拽滚动回调 */
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  
  /** 结束拖拽滚动回调 */
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  
  /** 图片缓存管理器 */
  cache: Cache;
}

/**
 * Reader 组件引用接口
 * 提供外部控制阅读器的方法
 */
export interface ReaderRef {
  /** 滚动到指定索引的页面 */
  scrollToIndex: (index: number, animated?: boolean) => void;
  
  /** 滚动到指定偏移量 */
  scrollToOffset: (offset: number, animated?: boolean) => void;
  
  /** 清空所有图片状态引用 */
  clearStateRef: () => void;
}

// ==================== 自定义 Hooks ====================

/**
 * 将图片列表按指定大小分组（用于双页模式）
 * 
 * 功能说明：
 * - 将图片列表按 size 个一组进行分组
 * - 确保同一组的图片来自同一章节（chapterHash 相同）
 * - 根据 seat 参数决定是否反转组内顺序
 * 
 * @param data - 图片数据列表
 * @param size - 每组的大小（默认2，即双页模式）
 * @param seat - 双页阅读顺序
 * @returns 分组后的图片列表，每个元素是一个图片数组
 * 
 * @example
 * // 输入: [img1, img2, img3, img4]
 * // 输出: [[img1, img2], [img3, img4]] (AToB)
 * // 输出: [[img2, img1], [img4, img3]] (BToA)
 */
const useTakeTwo = (data: Required<ReaderProps>['data'], size = 2, seat: MultipleSeat) => {
  return useMemo(() => {
    const list: Required<ReaderProps>['data']['0'][][] = [];

    for (let i = 0; i < data?.length; ) {
      // 从当前位置开始，取最多 size 个图片
      // 但只取同一章节的图片（确保双页模式不会跨章节）
      const batch = data.slice(i, i + size).reduce<typeof data>((dict, item) => {
        if (dict?.length <= 0) {
          // 第一张图片，直接添加
          dict.push(item);
        } else if (dict[0].chapterHash === item.chapterHash) {
          // 同一章节的图片，添加到当前组
          dict.push(item);
        }
        return dict;
      }, []);

      // 根据阅读顺序决定是否反转组内顺序
      list.push(seat === MultipleSeat.AToB ? batch : batch.reverse());
      i += batch?.length;
    }

    return list;
  }, [data, size, seat]);
};

/**
 * Reader 组件主函数
 * 
 * 使用 forwardRef 和 memo 优化性能：
 * - forwardRef: 允许父组件通过 ref 调用子组件方法
 * - memo: 仅在 props 变化时重新渲染
 */
const Reader: ForwardRefRenderFunction<ReaderRef, ReaderProps> = (
  {
    initPage = 0,
    inverted = false,
    seat = MultipleSeat.AToB,
    layoutMode = LayoutMode.Horizontal,
    data = [],
    headers = {},
    onTap,
    onLongPress,
    onImageLoad,
    onPageChange,
    onLoadMore,
    onZoomStart,
    onZoomEnd,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    cache,
  },
  ref
) => {
  // ==================== Hooks 和状态 ====================
  
  /** 窗口尺寸和方向（防抖处理，避免频繁更新） */
  const { width: windowWidth, height: windowHeight, orientation } = useDebouncedSafeAreaFrame();
  
  /** 双页模式下的分组数据 */
  const multipleData = useTakeTwo(data, 2, seat);
  
  /** FlashList 组件引用 */
  const flashListRef = useRef<FlashList<any> | null>(null);
  
  /** 横向模式下的图片状态缓存（按索引存储） */
  const horizontalStateRef = useRef<(ImageState | null)[]>([]);
  
  /** 纵向模式下的图片状态缓存（按索引存储） */
  const verticalStateRef = useRef<(ImageState | null)[]>([]);
  
  /** 双页模式下的图片状态缓存（按索引和 URI 存储） */
  const multipleStateRef = useRef<Record<string, ImageState | null>[]>([]);

  // ==================== 默认高度计算 ====================
  
  /**
   * 计算默认图片高度
   * 竖屏：使用较大的尺寸（通常是高度）的 3/5
   * 横屏：使用较小的尺寸（通常是宽度）的 3/5
   */
  const portraitHeight = (Math.max(windowWidth, windowHeight) * 3) / 5;
  const landscapeHeight = (Math.min(windowWidth, windowHeight) * 3) / 5;
  
  /** 竖屏默认高度引用（会在图片加载后动态更新） */
  const defaultPortraitHeightRef = useRef(portraitHeight);
  
  /** 横屏默认高度引用（会在图片加载后动态更新） */
  const defaultLandscapeHeightRef = useRef(landscapeHeight);

  // ==================== 回调引用 ====================
  
  /**
   * 页面变化回调引用
   * 使用 ref 存储回调，避免在 FlashList 的 onViewableItemsChanged 中闭包问题
   * 参考: https://github.com/Shopify/flash-list/issues/637
   */
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  // ==================== 计算属性 ====================
  
  /**
   * 初始滚动索引
   * 根据布局模式计算：
   * - 横向/纵向模式：直接使用 initPage
   * - 双页模式：将页面索引转换为组索引（每2页为一组）
   */
  const initialScrollIndex = useMemo(() => {
    if (layoutMode !== LayoutMode.Multiple) {
      // 横向和纵向模式：直接使用页面索引
      return Math.max(Math.min(initPage, data?.length - 1), 0);
    } else {
      // 双页模式：将页面索引转换为组索引
      // 例如：第1-2页 → 组0，第3-4页 → 组1
      return Math.max(Math.min(Math.ceil((initPage + 1) / 2) - 1, multipleData?.length - 1), 0);
    }
  }, [initPage, data?.length, multipleData, layoutMode]);

  // ==================== 生命周期 ====================
  
  /**
   * 页面失去焦点时清空状态引用
   * 避免内存泄漏，释放图片状态缓存
   */
  useFocusEffect(
    useCallback(() => {
      return () => {
        horizontalStateRef.current = [];
        verticalStateRef.current = [];
        multipleStateRef.current = [];
      };
    }, [])
  );

  // ==================== 暴露给父组件的方法 ====================
  
  /**
   * 通过 ref 暴露的方法
   * 允许父组件控制阅读器的滚动行为
   */
  useImperativeHandle(ref, () => ({
    /**
     * 滚动到指定索引的页面
     * @param index - 目标页面索引
     * @param animated - 是否使用动画（默认 true）
     */
    scrollToIndex: (index: number, animated = true) => {
      flashListRef.current?.scrollToIndex({ index, animated });
    },
    
    /**
     * 滚动到指定偏移量
     * @param offset - 目标偏移量（像素）
     * @param animated - 是否使用动画（默认 true）
     */
    scrollToOffset: (offset: number, animated = true) => {
      flashListRef.current?.scrollToOffset({ offset, animated });
    },
    
    /**
     * 清空所有图片状态引用
     * 用于切换章节时重置状态
     */
    clearStateRef: () => {
      horizontalStateRef.current = [];
      verticalStateRef.current = [];
      multipleStateRef.current = [];
    },
  }));

  // ==================== 视图变化处理 ====================
  
  /**
   * 横向和纵向模式的视图变化处理
   * 
   * 注意：使用函数组件而不是 useCallback，因为 FlashList 的 onViewableItemsChanged
   * 在构造函数中绑定，不会随 props 更新而更新
   * 参考: https://github.com/Shopify/flash-list/issues/637
   * 
   * @param viewableItems - 当前可见的视图项列表
   * @param changed - 变化的视图项列表（未使用）
   */
  const HandleViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken<any>[];
    changed: ViewToken<any>[];
  }) => {
    if (!viewableItems || viewableItems?.length <= 0) {
      return;
    }

    // 获取最后一个可见项（通常是当前主要显示的页面）
    const last = viewableItems[viewableItems?.length - 1];
    onPageChangeRef.current && onPageChangeRef.current(last.index || 0);
  };
  
  /**
   * 双页模式的视图变化处理
   * 
   * 双页模式下，需要将组索引转换为实际页面索引
   * 例如：组0（包含第1-2页）→ 页面索引 = pre + current - 1
   * 
   * @param viewableItems - 当前可见的视图项列表
   * @param changed - 变化的视图项列表（未使用）
   */
  const HandleMultipleViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ViewToken<(typeof multipleData)[0]>[];
    changed: ViewToken<(typeof multipleData)[0]>[];
  }) => {
    if (!viewableItems || viewableItems?.length <= 0) {
      return;
    }

    // 获取最后一个可见组
    const last = viewableItems[viewableItems?.length - 1];
    // 计算实际页面索引：使用组内第一张图片的 pre + current - 1
    if (last.item && Array.isArray(last.item) && last.item[0]) {
      onPageChangeRef.current && onPageChangeRef.current(
        last.item[0].pre + last.item[0].current - 1
      );
    }
  };
  // ==================== 渲染函数 ====================
  
  /**
   * 横向模式下的列表项渲染
   * 
   * 特点：
   * - 每页显示一张图片
   * - 支持横向滑动翻页
   * - 支持图片缩放
   * - 使用 Controller 处理点击和长按事件
   */
  const renderHorizontalItem = useCallback(({ item, index }: ListRenderItemInfo<(typeof data)[0]>) => {
    const { uri, scrambleType, needUnscramble, isBase64Image = false } = item;
    
    // 获取缓存的图片状态（用于恢复缩放、位置等）
    const horizontalState = horizontalStateRef.current[index] || undefined;
    
    return (
      <Controller
        horizontal
        onTap={onTap}
        onLongPress={(position) => onLongPress && onLongPress(position, horizontalState?.dataUrl)}
        onZoomStart={onZoomStart}
        onZoomEnd={onZoomEnd}
        safeAreaType={SafeArea.All}
      >
        <ComicImage
          uri={uri}
          index={index}
          scrambleType={scrambleType}
          needUnscramble={needUnscramble}
          isBase64Image={isBase64Image}
          headers={headers}
          prevState={horizontalState}
          defaultPortraitHeight={defaultPortraitHeightRef.current}
          defaultLandscapeHeight={defaultLandscapeHeightRef.current}
          layoutMode={LayoutMode.Horizontal}
          onChange={(state, idx = index) => {
            // 保存图片状态到 ref（用于恢复）
            horizontalStateRef.current[idx] = state;
            // 触发图片加载完成回调
            onImageLoad && onImageLoad(uri, item.chapterHash, item.current);
          }}
        />
      </Controller>
    );
  }, [onTap, onLongPress, onZoomStart, onZoomEnd, headers, onImageLoad]);
  
  /**
   * 纵向模式下的列表项渲染（条漫模式）
   * 
   * 特点：
   * - 每项显示一张图片
   * - 支持纵向滚动
   * - 图片高度根据实际加载的尺寸动态调整
   * - 使用缓存优化滚动性能
   */
  const renderVerticalItem = useCallback(({ item, index }: ListRenderItemInfo<(typeof data)[0]>) => {
    const { uri, scrambleType, needUnscramble, isBase64Image = false } = item;
    
    // 获取内存中的图片状态
    const verticalState = verticalStateRef.current[index] || undefined;
    
    // 获取持久化缓存中的图片状态（用于快速恢复高度）
    const cacheState = cache.getImageState(uri);
    
    return (
      <Box
        overflow="hidden"
        style={{
          height:
            orientation === Orientation.Portrait
              ? // 竖屏：优先使用内存状态，其次缓存，最后默认值
                verticalState?.portraitHeight ||
                cacheState?.portraitHeight ||
                defaultPortraitHeightRef.current
              : // 横屏：优先使用内存状态，其次缓存，最后默认值
                verticalState?.landscapeHeight ||
                cacheState?.landscapeHeight ||
                defaultLandscapeHeightRef.current,
        }}
      >
        <Controller
          onTap={onTap}
          onLongPress={(position) => onLongPress && onLongPress(position, verticalState?.dataUrl)}
          onZoomStart={onZoomStart}
          onZoomEnd={onZoomEnd}
          safeAreaType={SafeArea.X} // 纵向模式只需要 X 轴安全区域
        >
          <ComicImage
            uri={uri}
            index={index}
            scrambleType={scrambleType}
            needUnscramble={needUnscramble}
            isBase64Image={isBase64Image}
            headers={headers}
            prevState={verticalState}
            defaultPortraitHeight={defaultPortraitHeightRef.current}
            defaultLandscapeHeight={defaultLandscapeHeightRef.current}
            layoutMode={LayoutMode.Vertical}
            onChange={(state, idx = index) => {
              // 保存到持久化缓存（用于下次快速加载）
              cache.setImageState(uri, state);
              
              // 保存到内存引用（用于当前会话）
              verticalStateRef.current[idx] = state;
              
              // 触发图片加载完成回调
              onImageLoad && onImageLoad(uri, item.chapterHash, item.current);

              // 动态更新默认高度（基于已加载图片的中位数高度）
              // 这样可以优化后续图片的预估高度，提升滚动性能
              const defaultHeight = getDefaultFillMedianHeight(
                verticalStateRef.current.filter(
                  (imageState): imageState is ImageState => imageState !== null
                ),
                { portrait: portraitHeight, landscape: landscapeHeight }
              );
              defaultPortraitHeightRef.current = defaultHeight.portrait;
              defaultLandscapeHeightRef.current = defaultHeight.landscape;
            }}
          />
        </Controller>
      </Box>
    );
  }, [onTap, onLongPress, onZoomStart, onZoomEnd, headers, onImageLoad, orientation, cache, portraitHeight, landscapeHeight]);
  
  /**
   * 双页模式下的列表项渲染
   * 
   * 特点：
   * - 每项显示两张图片（并排显示）
   * - 支持横向滑动翻页
   * - 每张图片独立处理长按事件（用于保存）
   */
  const renderMultipleItem = useCallback(({ item, index }: ListRenderItemInfo<(typeof multipleData)[0]>) => {
    return (
      <Controller
        horizontal
        safeAreaType={SafeArea.All}
        onTap={onTap}
        onZoomStart={onZoomStart}
        onZoomEnd={onZoomEnd}
      >
        <Flex w="full" h="full" flexDirection="row" alignItems="center" justifyContent="center">
          {item.map(
            ({
              uri,
              scrambleType,
              needUnscramble,
              chapterHash,
              current,
              isBase64Image = false,
            }) => {
              // 获取当前图片的状态（使用 URI 作为 key）
              const multipleState = (multipleStateRef.current[index] || {})[uri] || undefined;
              
              return (
                <Box key={uri}>
                  {/* 每张图片独立的长按控制器（用于保存图片） */}
                  <LongPressController
                    onLongPress={() =>
                      onLongPress && onLongPress(PositionX.Mid, multipleState?.dataUrl)
                    }
                  >
                    <ComicImage
                      uri={uri}
                      index={index}
                      scrambleType={scrambleType}
                      needUnscramble={needUnscramble}
                      isBase64Image={isBase64Image}
                      headers={headers}
                      prevState={multipleState}
                      defaultPortraitHeight={defaultPortraitHeightRef.current}
                      defaultLandscapeHeight={defaultLandscapeHeightRef.current}
                      layoutMode={LayoutMode.Multiple}
                      onChange={(state, idx = index) => {
                        // 初始化索引对象（如果不存在）
                        if (typeof multipleStateRef.current[idx] !== 'object') {
                          multipleStateRef.current[idx] = {};
                        }
                        // 保存图片状态（使用 URI 作为 key）
                        multipleStateRef.current[idx][uri] = state;
                        // 触发图片加载完成回调
                        onImageLoad && onImageLoad(uri, chapterHash, current);
                      }}
                    />
                  </LongPressController>
                </Box>
              );
            }
          )}
        </Flex>
      </Controller>
    );
  }, [onTap, onLongPress, onZoomStart, onZoomEnd, headers, onImageLoad]);

  // ==================== 根据布局模式渲染不同的 FlashList ====================
  
  /**
   * 双页模式渲染
   * 
   * 配置说明：
   * - horizontal: 横向滚动
   * - pagingEnabled: 启用分页滚动（每次滑动一页）
   * - onEndReachedThreshold: 3（距离底部3个item时触发加载更多）
   * - viewabilityConfig: 50%（item 可见50%时认为可见）
   * - inverted: 反转滚动方向（用于从右到左阅读）
   */
  if (layoutMode === LayoutMode.Multiple) {
    return (
      <FlashList
        key="multiple"
        ref={flashListRef}
        data={multipleData}
        {...({ inverted } as any)} // FlashList 可能不支持 inverted，但实际运行时可用
        horizontal
        pagingEnabled
        extraData={{ inverted, onTap, onLongPress, onImageLoad }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        initialScrollIndex={initialScrollIndex}
        estimatedItemSize={windowWidth}
        estimatedListSize={{ width: windowWidth, height: windowHeight }}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onEndReached={onLoadMore}
        onEndReachedThreshold={3} // 距离底部3个item时触发
        onViewableItemsChanged={HandleMultipleViewableItemsChanged}
        renderItem={renderMultipleItem}
        keyExtractor={(item) => item.map((i) => i.uri).join('#')}
      />
    );
  }

  /**
   * 横向翻页模式渲染
   * 
   * 配置说明：
   * - horizontal: 横向滚动
   * - pagingEnabled: 启用分页滚动
   * - onEndReachedThreshold: 5（距离底部5个item时触发加载更多）
   * - inverted: 反转滚动方向（用于从右到左阅读）
   */
  if (layoutMode === LayoutMode.Horizontal) {
    return (
      <FlashList
        key="horizontal"
        ref={flashListRef}
        data={data}
        {...({ inverted } as any)} // FlashList 可能不支持 inverted，但实际运行时可用
        horizontal
        pagingEnabled
        extraData={{ inverted, onTap, onLongPress, onImageLoad }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        initialScrollIndex={initialScrollIndex}
        estimatedItemSize={windowWidth}
        estimatedListSize={{ width: windowWidth, height: windowHeight }}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onEndReached={onLoadMore}
        onEndReachedThreshold={5} // 距离底部5个item时触发
        onViewableItemsChanged={HandleViewableItemsChanged}
        renderItem={renderHorizontalItem}
        keyExtractor={(item) => item.uri}
      />
    );
  }

  /**
   * 纵向滚动模式渲染（条漫模式）
   * 
   * 配置说明：
   * - 纵向滚动（默认）
   * - overrideItemLayout: 使用缓存的高度优化布局计算
   * - ListHeaderComponent/ListFooterComponent: 添加安全区域占位
   * - onEndReachedThreshold: 5（距离底部5个item时触发加载更多）
   * - inverted: 反转滚动方向（用于从下到上阅读）
   */
  return (
    <FlashList
      key="vertical"
      ref={flashListRef}
      data={data}
      {...({ inverted } as any)} // FlashList 可能不支持 inverted，但实际运行时可用
      extraData={{ inverted, onTap, onLongPress, onImageLoad }}
      initialScrollIndex={initialScrollIndex}
      estimatedItemSize={(windowHeight * 3) / 5} // 默认高度估算
      estimatedListSize={{ width: windowWidth, height: windowHeight }}
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
      onScrollEndDrag={onScrollEndDrag}
      onEndReached={onLoadMore}
      onEndReachedThreshold={5} // 距离底部5个item时触发
      onViewableItemsChanged={HandleViewableItemsChanged}
      renderItem={renderVerticalItem}
      keyExtractor={(item) => item.uri}
      ListHeaderComponent={<Box height={0} safeAreaTop />}
      ListFooterComponent={<Box height={0} safeAreaBottom />}
      overrideItemLayout={(layout, item) => {
        // 使用缓存的高度优化布局计算，提升滚动性能
        const state = cache.getImageState(item.uri);
        if (state) {
          // FlashList 的 layout 对象使用 size 属性设置高度
          (layout as any).size =
            orientation === Orientation.Portrait ? state.portraitHeight : state.landscapeHeight;
        }
      }}
    />
  );
};

/**
 * 导出组件
 * - memo: 仅在 props 变化时重新渲染
 * - forwardRef: 支持 ref 传递
 */
export default memo(forwardRef(Reader));
