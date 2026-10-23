/** 注册表决定列表成员及元数据，缓存仅提供排序和开关；不复活已卸载的源。 */
export const reconcilePluginList = <T extends { value: string; disabled: boolean }>(saved: T[], registered: T[]): T[] => {
  const registry = new Map(registered.map((item) => [item.value, item]));
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of saved) {
    const current = registry.get(item.value);
    if (!current || seen.has(item.value)) continue;
    seen.add(item.value);
    result.push({ ...current, disabled: item.disabled });
  }
  return result.concat(registered.filter((item) => !seen.has(item.value)));
};
