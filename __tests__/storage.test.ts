jest.mock('react-native-mmkv', () => ({
  createMMKV: ({ id }: { id: string }) => {
    const mockNamespaces: Map<string, Map<string, string>> =
      ((globalThis as any).__mmkvNamespaces ||= new Map());
    const values = mockNamespaces.get(id) || new Map<string, string>();
    mockNamespaces.set(id, values);
    return {
      set: (key: string, value: string) => values.set(key, value),
      getString: (key: string) => values.get(key),
    };
  },
}));

import { APP_STORAGE_ID, createAppStorage } from '../src/utils/storage';

describe('MMKV application namespace', () => {
  it('uses an explicit application-specific namespace', () => {
    expect(APP_STORAGE_ID).toBe('manga-reader-storage');
  });

  it('persists values when the storage instance is recreated', () => {
    const first = createAppStorage();
    first.set('@plugin', 'COPY');
    const recreated = createAppStorage();
    expect(recreated.getString('@plugin')).toBe('COPY');
  });

  it('does not share data with another namespace', () => {
    const mockNamespaces: Map<string, Map<string, string>> = (globalThis as any).__mmkvNamespaces;
    expect(mockNamespaces.get('another-app')?.get('@plugin')).toBeUndefined();
  });
});
