const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const reanimatedStubPath = path.resolve(__dirname, 'src/utils/reanimated-stub.js');

// Use Reanimated stub when native module is unavailable (Expo Go, web).
// Reanimated native module fails in Expo Go with NullPointerException.
const wrapResolver = (resolver) => {
  const original = resolver?.resolveRequest;
  return {
    ...resolver,
    resolveRequest(context, moduleName, platform) {
      if (moduleName === 'react-native-reanimated') {
        return { type: 'sourceFile', filePath: reanimatedStubPath };
      }
      return original
        ? original(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
    },
  };
};

const baseConfig = withNativeWind(config, { input: './app/style.css' });
baseConfig.resolver = wrapResolver(baseConfig.resolver || {});

// Exclude react-native-worklets CMake build cache from Metro watcher (avoids ENOENT when .cxx dir is missing)
baseConfig.resolver.blockList = [
  /[\/\\]react-native-worklets[\/\\]android[\/\\]\.cxx[\/\\].*/,
  ...(Array.isArray(baseConfig.resolver.blockList) ? baseConfig.resolver.blockList : []),
];

module.exports = baseConfig;
