const baseUrl = process.env.EXPO_PUBLIC_BASE_URL ?? '';

module.exports = {
  expo: {
    scheme: 'featherneko',
    name: 'FeatherNeko',
    slug: 'featherneko',
    userInterfaceStyle: 'dark',
    backgroundColor: '#111827',
    icon: './assets/images/icon.png',
    splash: {
      image: './assets/images/splash-screen.png',
      resizeMode: 'contain',
      backgroundColor: '#111827',
    },
    favicon: './assets/images/favicon.png',
    android: {
      package: 'com.anonymous.featherneko',
      softwareKeyboardLayoutMode: 'resize',
      // Edge-to-edge is mandatory on Android 15+. Nav bar barStyle for button contrast.
      navigationBar: { barStyle: 'light' },
      adaptiveIcon: {
        foregroundImage: './assets/images/android-icon-foreground.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
        backgroundColor: '#111827',
      },
    },
    // Status bar icon style (edge-to-edge/translucent is default on Android 15+).
    androidStatusBar: {
      barStyle: 'light-content',
    },
    ios: {
      bundleIdentifier: 'com.anonymous.featherneko',
      backgroundColor: '#111827',
    },
    web: {
      output: 'single',
    },
    // For GitHub Pages subpath (username.github.io/repo). Use EXPO_PUBLIC_BASE_URL="/repo" or leave empty for custom domain.
    ...(baseUrl && { experiments: { baseUrl } }),
    plugins: [
      'expo-font',
      'expo-router',
      'expo-web-browser',
      'expo-video',
      [
        'expo-navigation-bar',
        {
          barStyle: 'light',
          // Let our tab bar background show in nav bar zone (no system scrim) for unified look
          enforceContrast: false,
        },
      ],
      './plugins/withAndroidTransitionFix.js',
      './plugins/withImmersiveMode.js',
    ],
  },
};
