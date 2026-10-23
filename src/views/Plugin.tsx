import React, { useState } from 'react';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { action, useAppSelector, useAppDispatch } from '@/redux';
import { Box, Button, Input, Text, VStack, HStack, Switch } from 'native-base';
import { useDebouncedSafeAreaInsets } from '@/hooks';
import { Plugin as PluginType, registerUserSources } from '@/plugins';
import { StyleSheet, TouchableOpacity } from 'react-native';
import ScoreRate from '@/components/ScoreRate';
import jssdk from '@htyf-mp/js-sdk';
import InTreeDialog from '@/components/InTreeDialog';
import { importUserSources } from '@/source-rules';

const { sortPlugin, disablePlugin, syncPlugin } = action;
const styles = StyleSheet.create({ list: { flex: 1 } });

const Plugin = ({ navigation: { navigate } }: StackPluginProps) => {
  const dispatch = useAppDispatch();
  const list = useAppSelector((state) => state.plugin.list);
  const source = useAppSelector((state) => state.plugin.source);
  const extra = useAppSelector((state) => state.plugin.extra);
  const [showImport, setShowImport] = useState(false);
  const [sourceJson, setSourceJson] = useState('');
  const { left, right, bottom } = useDebouncedSafeAreaInsets();

  const handleToggle = (plugin: PluginType) => {
    dispatch(disablePlugin(plugin));
  };
  const handleImport = () => {
    try {
      const imported = importUserSources(sourceJson);
      registerUserSources(imported);
      // 已存在源保留用户排序和开关；新增源由实时注册表自动追加。
      dispatch(syncPlugin({ source, extra, list }));
      setSourceJson('');
      setShowImport(false);
      jssdk.showToast({ type: 'success', title: `已导入 ${imported.length} 个漫画源` });
    } catch (error) {
      jssdk.showToast({ type: 'error', title: error instanceof Error ? error.message : '漫画源导入失败' });
    }
  };
  const renderItem = ({ item, drag, isActive }: RenderItemParams<(typeof list)[0]>) => (
    <ScaleDecorator>
      <TouchableOpacity onLongPress={drag} disabled={isActive}>
        <HStack space={6} key={item.value} alignItems="center" flexDirection="row" px={4} py={3}>
          <VStack space={1} flexGrow={1} w={0}>
            <Text
              fontSize="lg"
              fontWeight="bold"
              color="purple.500"
              onPress={() =>
                navigate('Webview', {
                  uri: item.href,
                  source: item.value,
                  userAgent: item.userAgent,
                  injectedJavascript: item.injectedJavaScript,
                })
              }
              textDecorationLine={item.disabled ? 'line-through' : 'none'}
            >
              {item.name} - {item.label} 🔗
            </Text>
            {item.description && <Text fontSize="sm">{item.description}</Text>}
            <HStack alignItems="center">
              <Text fontSize="sm">推荐指数：</Text>
              <ScoreRate score={item.score} />
            </HStack>
          </VStack>
          <Switch
            size="md"
            onTrackColor="purple.500"
            value={!item.disabled}
            onToggle={() => handleToggle(item.value)}
          />
        </HStack>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <Box position="relative" flex={1}>
      {jssdk.AdBanner && <jssdk.AdBanner />}
      <Button m={3} onPress={() => setShowImport(true)}>导入 JSON 漫画源</Button>
      <DraggableFlatList
        // 拖拽组件外层 Animated.View 不继承内层 style，必须单独占满剩余高度。
        containerStyle={styles.list}
        style={styles.list}
        data={list}
        renderItem={renderItem}
        keyExtractor={(item) => item.value}
        onDragEnd={({ data }) => dispatch(sortPlugin(data))}
        contentContainerStyle={{ paddingLeft: left, paddingRight: right, paddingBottom: bottom }}
      />
      {/* for navigation gesture go back */}
      <Box w={4} position="absolute" top={0} bottom={0} left={left} bg="transparent" />
      <InTreeDialog visible={showImport} onRequestClose={() => setShowImport(false)} fullWidth>
        <VStack w="full" p={4} space={3}>
          <Text fontSize="lg" fontWeight="bold">导入 MangaReader JSON 漫画源</Text>
          <Input
            multiline
            h={48}
            textAlignVertical="top"
            value={sourceJson}
            onChangeText={setSourceJson}
            placeholder="粘贴单个漫画源对象或漫画源数组"
          />
          <HStack justifyContent="flex-end" space={2}>
            <Button variant="ghost" onPress={() => setShowImport(false)}>取消</Button>
            <Button isDisabled={!sourceJson.trim()} onPress={handleImport}>导入</Button>
          </HStack>
        </VStack>
      </InTreeDialog>
    </Box>
  );
};

export default Plugin;
