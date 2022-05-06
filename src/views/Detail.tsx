import React, { useEffect } from 'react';
import { Box, Flex, Image, Text, ScrollView, IconButton, Icon } from 'native-base';
import { action, useAppSelector, useAppDispatch } from '~/redux';
import { TouchableOpacity, Dimensions } from 'react-native';
import { coverAspectRatio } from '~/utils';
import { useRoute } from '@react-navigation/native';
import ErrorWithRetry from '~/components/ErrorWithRetry';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Loading from '~/components/Loading';

const { LoadStatus } = window;
const { loadManga, addFavorites, removeFavorites } = action;
const gap = 4;
const windowWidth = Dimensions.get('window').width;
const quarterWidth = (windowWidth - gap * 5) / 4;

const Detail = ({ route, navigation }: StackDetailProps) => {
  const id = route.params.id;
  const dispatch = useAppDispatch();
  const loadStatus = useAppSelector((state) => state.manga.loadStatus);
  const mangaDict = useAppSelector((state) => state.dict.manga);
  const historyDict = useAppSelector((state) => state.dict.history);
  const mangaToChapter = useAppSelector((state) => state.dict.mangaToChapter);

  const data = mangaDict[id] || undefined;
  const { lastWatchChapterId } = historyDict[id] || {};
  const chapterList = mangaToChapter[id] || [];
  const canUse = !!data;

  useEffect(() => {
    dispatch(loadManga(id));
  }, [dispatch, id]);

  useEffect(() => {
    canUse && navigation.setOptions({ title: data.title });
  }, [canUse, navigation, data]);

  const handleChapter = (mangaId: string, chapterId: string) => {
    return () => {
      navigation.navigate('Chapter', { mangaId, chapterId });
    };
  };
  const handleReload = () => {
    dispatch(loadManga(id));
  };

  if (!canUse) {
    return null;
  }

  return (
    <ScrollView>
      <Flex w="100%" bg="#6200ee" flexDirection="row" pl={4} pr={4} pb={5}>
        <Image
          w={130}
          h={130 / coverAspectRatio}
          flexGrow={0}
          flexShrink={0}
          source={{ uri: data.cover }}
          resizeMode="cover"
          borderRadius="md"
          alt="cover"
        />
        <Flex flexGrow={1} flexShrink={1} pl={4}>
          <Text color="white" fontSize={20} fontWeight="bold" numberOfLines={2}>
            {data.title}
          </Text>
          <Text color="white" fontSize={14} fontWeight="bold" numberOfLines={1}>
            {data.author}
          </Text>
          <Box flexGrow={1} />
          <Text color="white" fontSize={14} fontWeight="bold" numberOfLines={1}>
            {data.updateTime}
          </Text>
        </Flex>
      </Flex>
      {loadStatus === LoadStatus.Pending && <Loading />}
      {loadStatus === LoadStatus.Rejected && <ErrorWithRetry onRetry={handleReload} />}
      {loadStatus === LoadStatus.Fulfilled && (
        <Flex flexWrap="wrap" flexDirection="row" p={gap / 2}>
          {chapterList.map((item) => {
            const isActived = item.chapterId === lastWatchChapterId;
            return (
              <TouchableOpacity
                key={item.chapterId}
                activeOpacity={0.8}
                onPress={handleChapter(item.mangaId, item.chapterId)}
              >
                <Box w={quarterWidth} p={gap / 2}>
                  <Text
                    bg={isActived ? '#6200ee' : 'transparent'}
                    color={isActived ? 'white' : '#717171'}
                    borderColor="#717171"
                    overflow="hidden"
                    borderRadius="md"
                    borderWidth={isActived ? 0 : 0.5}
                    textAlign="center"
                    numberOfLines={1}
                    fontWeight="bold"
                    p={[1, 0]}
                  >
                    {item.title}
                  </Text>
                </Box>
              </TouchableOpacity>
            );
          })}
        </Flex>
      )}
    </ScrollView>
  );
};

export const Heart = () => {
  const route = useRoute<StackDetailProps['route']>();
  const dispatch = useAppDispatch();
  const favorites = useAppSelector((state) => state.favorites);
  const id = route.params.id;

  const handleFavorite = () => {
    dispatch(addFavorites(id));
  };
  const handleUnfavorite = () => {
    dispatch(removeFavorites(id));
  };

  if (favorites.includes(id)) {
    return (
      <IconButton
        icon={<Icon as={MaterialIcons} name="favorite" size={30} color="red.500" />}
        onPress={handleUnfavorite}
      />
    );
  }
  return (
    <IconButton
      icon={<Icon as={MaterialIcons} name="favorite-outline" size={30} color="white" />}
      onPress={handleFavorite}
    />
  );
};

export default Detail;
