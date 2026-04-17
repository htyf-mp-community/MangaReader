import React, { Fragment, useMemo } from 'react';
import { StatusBar, HStack, Text, useTheme, View } from 'native-base';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { getHeaderTitle } from '@react-navigation/elements';
import VectorIcon from '@/components/VectorIcon';
import Shake from '@/components/Shake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import jssdk from '@htyf-mp/js-sdk';

interface HeaderProps extends NativeStackHeaderProps {
  enableShake?: boolean;
}

const Header = ({ navigation, options, route, enableShake = false }: HeaderProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const title = getHeaderTitle(options, route.name);
  const canGoBack = useMemo(() => navigation.canGoBack(), [navigation]);

  const handleAbout = () => {
    navigation.navigate('About');
  };
  const handleBack = () => {
    navigation.goBack();
  };

  const { headerLeft, headerRight } = options;
  const Left = headerLeft ? (headerLeft as any)({ canGoBack, route, navigation }) : null;
  const Right = headerRight ? (headerRight as any)({ canGoBack, route, navigation }) : null;
  const headerStyle = useMemo(() => {
    const menuButton = jssdk.getMenuButtonBoundingClientRect();
    return {
      paddingTop: menuButton.top,
      paddingRight: menuButton.right + menuButton.width,
      height: menuButton.height || 80,
    }
  }, [insets]);
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
      >
        <HStack flex={1} flexGrow={1} justifyContent="flex-start" alignItems="center">
          {canGoBack ? (
            <VectorIcon name="arrow-back" size="2xl" onPress={handleBack} />
          ) : (
            <Shake enable={enableShake}>
              <VectorIcon name="home" size="2xl" onPress={handleAbout} />
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
        <View style={{ width: headerStyle.paddingRight }} />
      </HStack>
    </Fragment>
  );
};

export default Header;
