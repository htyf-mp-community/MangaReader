import { appStorage } from '@/utils/storage';
import { parseSourceManifest } from './manifest';
import type { MangaSourceManifest } from './types';

export const USER_SOURCE_STORAGE_KEY = 'manga-source-manifests.v1';

/** 解析用户导入的单个或数组 JSON；用户不能引用仅供应用内部使用的 builtin。 */
export const parseImportedSources = (text: string): MangaSourceManifest[] => {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('漫画源不是有效的 JSON');
  }
  const sources = (Array.isArray(input) ? input : [input]).map(parseSourceManifest);
  if (!sources.length) throw new Error('漫画源列表为空');
  if (sources.some((source) => source.engine !== 'declarative')) throw new Error('用户漫画源只能使用 declarative 引擎');
  if (new Set(sources.map((source) => source.id)).size !== sources.length) throw new Error('导入内容包含重复漫画源 id');
  return sources;
};

/** 以 id 更新漫画源，保留当前顺序并把新源追加在末尾。 */
export const mergeUserSources = (current: MangaSourceManifest[], incoming: MangaSourceManifest[]) => {
  const merged = [...current];
  incoming.forEach((source) => {
    const index = merged.findIndex((item) => item.id === source.id);
    if (index < 0) merged.push(source);
    else merged[index] = source;
  });
  return merged;
};

/** 从 MangaReader 专属 MMKV 命名空间读取用户漫画源。 */
export const loadUserSources = (): MangaSourceManifest[] => {
  const value = appStorage.getString(USER_SOURCE_STORAGE_KEY);
  if (!value) return [];
  try { return parseImportedSources(value); } catch { return []; }
};

/** 保存已经校验的声明式漫画源。 */
export const saveUserSources = (sources: MangaSourceManifest[]) => {
  const validated = parseImportedSources(JSON.stringify(sources));
  appStorage.set(USER_SOURCE_STORAGE_KEY, JSON.stringify(validated));
};

export const importUserSources = (text: string) => {
  const merged = mergeUserSources(loadUserSources(), parseImportedSources(text));
  saveUserSources(merged);
  return merged;
};
