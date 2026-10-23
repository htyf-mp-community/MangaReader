import { reconcilePluginList } from '@/utils/plugin-list';
import manifests from '@/source-rules/sources.json';

test('旧缓存恢复后展示全部 14 个默认源，保留用户开关及排序', () => {
  const defaults = manifests.map((item) => ({ value: item.id, disabled: !item.enabled, name: item.name }));
  const restored = reconcilePluginList([{ value: 'BZM', disabled: true, name: '旧名称' }], defaults);
  expect(restored).toHaveLength(14);
  expect(restored[0]).toEqual({ value: 'BZM', disabled: true, name: '包子漫画' });
  expect(restored.find((item) => item.value === 'HAPPY')?.disabled).toBe(true);
  expect(reconcilePluginList([], defaults)).toHaveLength(14);
});

test('合并默认列表不丢失已注册的用户源，也不产生重复条目', () => {
  const user = { value: 'custom.source', disabled: false };
  expect(reconcilePluginList([user, user], [{ value: 'BZM', disabled: false }, user]))
    .toEqual([user, { value: 'BZM', disabled: false }]);
});

test('移除默认源后旧缓存不能使它重新出现，支持仅外部源和空注册表', () => {
  const saved = [{ value: 'BZM', disabled: false }, { value: 'custom.source', disabled: true }];
  const external = { value: 'custom.source', disabled: false };
  expect(reconcilePluginList(saved, [external])).toEqual([{ ...external, disabled: true }]);
  expect(reconcilePluginList(saved, [])).toEqual([]);
});
