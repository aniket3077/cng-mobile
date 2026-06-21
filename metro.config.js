const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mock react-native-maps for web platform
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'sourceFile',
      filePath: require.resolve('./utils/react-native-maps-web-mock.tsx'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
