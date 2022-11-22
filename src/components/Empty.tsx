import React from 'react';
import { Center, Heading, Image } from 'native-base';

const beeGif = require('~/assets/tap_tap.gif');

interface EmptyProps {
  text?: string;
}

const Empty = ({ text = 'Nothing Here' }: EmptyProps) => {
  return (
    <Center w="full" h="full" pb={32}>
      <Image w={32} h={48} resizeMode="contain" source={beeGif} alt="bee" />
      <Heading color="gray.500" fontWeight="bold" fontSize="md">
        {text}
      </Heading>
    </Center>
  );
};

export default Empty;
