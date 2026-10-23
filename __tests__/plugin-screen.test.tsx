import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import manifests from '@/source-rules/sources.json';

jest.mock('@/redux', () => ({
  action: { sortPlugin: jest.fn(), disablePlugin: jest.fn(), syncPlugin: jest.fn() },
  useAppDispatch: () => jest.fn(),
  useAppSelector: (select: (state: unknown) => unknown) => select({ plugin: {
    source: 'COPY', extra: {},
    list: require('@/source-rules/sources.json').map((source: { id: string }) => ({ value: source.id })),
  } }),
}));
jest.mock('native-base', () => ({ Box: 'Box', Button: 'Button', Input: 'Input', Text: 'Text', VStack: 'VStack', HStack: 'HStack', Switch: 'Switch' }));
jest.mock('react-native-draggable-flatlist', () => ({ __esModule: true, default: 'DraggableList', ScaleDecorator: 'ScaleDecorator' }));
jest.mock('@/hooks', () => ({ useDebouncedSafeAreaInsets: () => ({ left: 0, right: 0, bottom: 34 }) }));
jest.mock('@/plugins', () => ({ registerUserSources: jest.fn() }));
jest.mock('@/source-rules', () => ({ importUserSources: jest.fn() }));
jest.mock('@/components/ScoreRate', () => 'ScoreRate');
jest.mock('@/components/InTreeDialog', () => 'InTreeDialog');
jest.mock('@htyf-mp/js-sdk', () => ({ __esModule: true, default: {} }));

import PluginScreen from '@/views/Plugin';

test('Plugin 页面把已加载源交给列表，并给拖拽列表外层分配剩余高度', async () => {
  let screen: ReactTestRenderer;
  const props: StackPluginProps = {
    navigation: { navigate: jest.fn() } as unknown as StackPluginProps['navigation'],
    route: { key: 'plugin-test', name: 'Plugin' },
  };
  await act(async () => { screen = create(<PluginScreen {...props} />); });
  try {
    const list = screen!.root.findByType('DraggableList' as any);
    expect(list.props.data.map((item: { value: string }) => item.value)).toEqual(manifests.map((item) => item.id));
    // DraggableFlatList 的 style 只传给内层 FlatList；外层 Animated.View 使用 containerStyle。
    expect(StyleSheet.flatten(list.props.containerStyle)?.flex).toBe(1);
    expect(StyleSheet.flatten(list.props.style)?.flex).toBe(1);
    expect(list.props.contentContainerStyle.paddingBottom).toBeGreaterThanOrEqual(34);
  } finally {
    await act(async () => screen!.unmount());
  }
});
