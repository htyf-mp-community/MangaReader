import React, { PropsWithChildren, useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InTreeDialogProps extends PropsWithChildren {
  visible: boolean;
  onRequestClose: () => void;
  fullWidth?: boolean;
}

/**
 * HTYF 页面树内弹层。
 * 通过绝对定位实现遮罩，不创建 RN Modal/原生窗口；同时处理遮罩点击和 Android 返回键。
 */
export default function InTreeDialog({
  visible,
  onRequestClose,
  fullWidth = false,
  children,
}: InTreeDialogProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => subscription.remove();
  }, [onRequestClose, visible]);

  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal
      style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="关闭弹窗"
        style={StyleSheet.absoluteFill}
        onPress={onRequestClose}
      />
      <View style={[styles.content, fullWidth && styles.fullWidth]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    width: '90%',
    maxWidth: 520,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  fullWidth: { width: '100%', maxWidth: undefined },
});
