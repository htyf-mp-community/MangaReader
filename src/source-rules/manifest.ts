import manifests from './sources.json';
import { MANGA_SOURCE_VERSION, type MangaSourceManifest } from './types';

/** 校验不可信 JSON 漫画源；协议禁止脚本字段和未知执行引擎。 */
export const parseSourceManifest = (input: unknown): MangaSourceManifest => {
  if (!input || typeof input !== 'object') throw new Error('漫画源必须是 JSON 对象');
  const value = input as Partial<MangaSourceManifest>;
  if (value.version !== MANGA_SOURCE_VERSION) throw new Error('不支持的漫画源版本');
  if (!value.id || !/^[A-Za-z][\w.-]{1,63}$/.test(value.id)) throw new Error('漫画源 id 无效');
  if (!value.name || !value.shortName || !value.baseUrl) throw new Error('漫画源缺少 name、shortName 或 baseUrl');
  if (!/^https?:\/\//i.test(value.baseUrl)) throw new Error('漫画源 baseUrl 必须使用 HTTP 或 HTTPS');
  if (!Array.isArray(value.capabilities)) throw new Error('漫画源 capabilities 无效');
  if (value.engine !== 'builtin' && value.engine !== 'declarative') throw new Error('漫画源执行引擎无效');
  if (value.engine === 'builtin' && !value.builtin) throw new Error('内置漫画源缺少 builtin 扩展名');
  if (value.engine === 'declarative' && !value.rules) throw new Error('声明式漫画源缺少 rules');
  if (JSON.stringify(value).match(/"(?:js|javascript|script)"\s*:/i)) throw new Error('漫画源协议不允许任意脚本');
  return value as MangaSourceManifest;
};

/** 随应用发布的 14 个 JSON 漫画源清单。 */
export const builtinSourceManifests = (manifests as unknown[]).map(parseSourceManifest);
