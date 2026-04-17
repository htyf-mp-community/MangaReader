module.exports = {
  commands: require('@callstack/repack/commands/webpack'),
  dependencies: {
    // Keep @d11/react-native-fast-image only; disable legacy package autolinking.
    'react-native-fast-image': {
      platforms: {
        android: null,
        ios: null
      }
    }
  }
};
