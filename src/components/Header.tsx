import React, { Fragment, useMemo } from 'react';
import { StatusBar, HStack, Text, useTheme } from 'native-base';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { getHeaderTitle } from '@react-navigation/elements';
import VectorIcon from '@/components/VectorIcon';
import Shake from '@/components/Shake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import jssdk from '@htyf-mp/js-sdk';
import { PixelRatio, useWindowDimensions } from 'react-native';
import { getCapsuleAvoidanceRight, normalizeCapsuleRect } from '@/utils/capsule';

interface HeaderProps extends NativeStackHeaderProps {
  enableShake?: boolean;
}

const Header = ({ navigation, options, route, back, enableShake = false }: HeaderProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const title = getHeaderTitle(options, route.name);
  // Native stack 会通过 back 随路由变化触发 Header 更新，避免缓存稳定 navigation
  // 对象上的 canGoBack 结果而显示出无法工作的返回按钮。
  const canGoBack = back != null;

  const handleAbout = () => {
    navigation.navigate('About');
  };
  const handleBack = () => {
    navigation.goBack();
  };

  const { headerLeft, headerRight } = options;
  const Left = headerLeft ? (headerLeft as any)({ canGoBack, route, navigation }) : null;
  const Right = headerRight ? (headerRight as any)({ canGoBack, route, navigation }) : null;
  const headerGeometry = useMemo(() => {
    const capsule = normalizeCapsuleRect(
      jssdk.getMenuButtonBoundingClientRect(),
      window,
      PixelRatio.get()
    );
    const top = Math.max(insets.top, capsule?.top ?? insets.top);
    const bottom = top + Math.max(44, capsule?.height ?? 44);
    const maxRight = getCapsuleAvoidanceRight({ top, bottom }, capsule, window.width, 10);
    return { minHeight: bottom - insets.top, paddingRight: Math.max(0, window.width - maxRight) };
  }, [insets.top, window]);
  return (
    <Fragment>
      <StatusBar animated backgroundColor={colors.purple[500]} barStyle="light-content" />
      <HStack
        bg="purple.500"
        p={1}
        w="full"
        justifyContent="space-between"
        alignItems="center"
        safeAreaTop
        safeAreaLeft
        safeAreaRight
        minH={headerGeometry.minHeight}
        pr={`${headerGeometry.paddingRight}px`}
      >
        <HStack flex={1} flexGrow={1} justifyContent="flex-start" alignItems="center">
          {canGoBack ? (
            <VectorIcon
              accessibilityLabel="返回"
              name="arrow-back"
              size="2xl"
              w="44px"
              h="44px"
              onPress={handleBack}
            />
          ) : (
            <Shake enable={enableShake}>
              <VectorIcon
                accessibilityLabel="关于"
                name="home"
                size="2xl"
                w="44px"
                h="44px"
                onPress={handleAbout}
              />
            </Shake>
          )}
          {title !== '' && (
            <Text flex={1} color="white" fontSize={25} fontWeight="bold" numberOfLines={1}>
              {title}
            </Text>
          )}
          {Left}
        </HStack>

        {Right}
      </HStack>
    </Fragment>
  );
};

export default Header;
