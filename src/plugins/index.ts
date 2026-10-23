import Base, { Plugin } from './base';
import MHGM from './mhgm';
import MHG from './mhg';
import COPY from './copy';
import MHDB from './mhdb';
import DMZJ from './dmzj';
import JMC from './jmc';
import MHM from './mhm';
import KL from './kl';
import NH from './nh';
import PICA from './pica';
import MBZ from './mbz';
import BZM from './bzm';
import RM5 from './rm5';
import HAPPY from './happy';
import { builtinSourceManifests, DeclarativeSource, loadUserSources, ManifestBackedSource, type MangaSourceManifest } from '@/source-rules';

export * from './base';

const builtinImplementations = new Map<Plugin, Base>([
  [COPY.id, COPY],
  [MBZ.id, MBZ],
  [HAPPY.id, HAPPY],
  [MHGM.id, MHGM],
  [JMC.id, JMC],
  [NH.id, NH],
  [PICA.id, PICA],
  [RM5.id, RM5],
  [KL.id, KL],
  [BZM.id, BZM],
  [DMZJ.id, DMZJ],
  [MHDB.id, MHDB],
  [MHM.id, MHM],
  [MHG.id, MHG],
]);
/**
 * JSON 清单决定漫画源的注册、排序和展示元数据；builtin 只承载无法安全声明化的
 * 签名、解密、图片解扰等扩展行为。缺失实现时启动即失败，避免静默隐藏漫画源。
 */
export const PluginMap = new Map<Plugin, Base>(
  builtinSourceManifests.map((manifest) => {
    const id = manifest.id as Plugin;
    const implementation = builtinImplementations.get(id);
    if (!implementation || implementation.id !== manifest.builtin) {
      throw new Error(`漫画源 ${manifest.id} 的内置扩展不存在`);
    }
    return [id, new ManifestBackedSource(manifest, implementation)];
  })
);
/** 注册已校验的用户声明式源，并返回可直接写入 Redux 的展示条目。 */
export const registerUserSources = (manifests: MangaSourceManifest[]) => manifests.map((manifest) => {
  const implementation = new DeclarativeSource(manifest);
  PluginMap.set(manifest.id as Plugin, implementation);
  return toPluginListItem(implementation);
});

const toPluginListItem = (item: Base) => ({
  label: item.shortName,
  name: item.name,
  value: item.id,
  score: item.score,
  href: item.href,
  userAgent: item.userAgent,
  description: item.description,
  disabled: item.disabled,
  injectedJavaScript: item.injectedJavaScript,
});

/** 当前已加载源的唯一列表来源；包含禁用源，同 id 导入覆盖后只显示当前实现。 */
export const getLoadedPluginList = () => Array.from(PluginMap.values(), toPluginListItem);

registerUserSources(loadUserSources());
export const combineHash = Base.combineHash;
export const splitHash = Base.splitHash;
/** 默认漫画源必须与源应用一致，避免首次启动时静默切换数据源。 */
export const defaultPlugin: Plugin = COPY.id;
/** 仅供 Redux 初始化使用的启动快照；后续同步必须读取实时注册表。 */
export const defaultPluginList = getLoadedPluginList();
