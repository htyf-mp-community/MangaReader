jest.mock('@/utils', () => ({ clearAllCookie: jest.fn(), MangaStatus: {}, ErrorMessage: {} }));
jest.mock('query-string', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: jest.fn(), set: jest.fn() }) }));

// 隔离网站请求实现，保留实际注册表、清单、声明式包装和导入链路。
for (const id of ['COPY', 'MBZ', 'HAPPY', 'MHGM', 'JMC', 'NH', 'PICA', 'RM5', 'KL', 'BZM', 'DMZJ', 'MHDB', 'MHM', 'MHG']) {
  jest.doMock(`@/plugins/${id.toLowerCase()}`, () => ({
    __esModule: true,
    default: { id, href: 'https://builtin.test/', defaultHeaders: {}, prepareSearchFetch: () => ({ url: 'https://builtin.test/search' }) },
  }));
}

const { getLoadedPluginList, registerUserSources, PluginMap } = require('@/plugins');

test('列表实时反映导入、同 id 覆盖以及卸载，不依赖启动默认快照', () => {
  const initial = new Map(PluginMap);
  try {
    expect(getLoadedPluginList()).toHaveLength(14);
    expect(PluginMap.get('COPY').prepareSearchFetch('test', 1, {})).toEqual({ url: 'https://builtin.test/search' });
    const source = { version: 1, id: 'COPY', name: '外部覆盖源', shortName: '外部', description: '', baseUrl: 'https://external.test/', enabled: true, score: 2, engine: 'declarative', capabilities: [], rules: {} };
    registerUserSources([source]);
    expect(getLoadedPluginList()).toHaveLength(14);
    expect(getLoadedPluginList().find((item: { value: string }) => item.value === 'COPY')).toMatchObject({ name: '外部覆盖源', href: 'https://external.test/' });
    PluginMap.clear();
    registerUserSources([{ ...source, id: 'external.only' }]);
    expect(getLoadedPluginList().map((item: { value: string }) => item.value)).toEqual(['external.only']);
    PluginMap.clear();
    expect(getLoadedPluginList()).toEqual([]);
  } finally {
    PluginMap.clear();
    initial.forEach((value, key) => PluginMap.set(key, value));
  }
});
