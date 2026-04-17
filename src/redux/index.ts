/**
 * Redux 统一导出文件
 * 
 * 功能说明：
 * 1. 导出所有 Redux 相关的模块（actions, reducer, store, saga）
 * 2. 提供类型安全的 hooks（useAppDispatch, useAppSelector）
 * 
 * 使用示例：
 * ```tsx
 * import { action, useAppSelector, useAppDispatch } from '@/redux';
 * 
 * const dispatch = useAppDispatch();
 * const setting = useAppSelector(state => state.setting);
 * dispatch(action.setMode(LayoutMode.Vertical));
 * ```
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { action, reducer } from './slice';
import saga from './saga';
import store from './store';

/**
 * 类型安全的 dispatch hook
 * 自动推断 dispatch 的类型
 */
const useAppDispatch = () => useDispatch<typeof store.dispatch>();

/**
 * 类型安全的 selector hook
 * 自动推断 RootState 类型
 */
const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export { action, reducer, store, saga, useAppSelector, useAppDispatch };
