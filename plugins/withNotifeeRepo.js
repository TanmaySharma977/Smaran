const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withNotifeeRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    const repoLine = 'maven { url "\$rootDir/../node_modules/react-native-notify-kit/android/libs" }';

    if (config.modResults.contents.includes('react-native-notify-kit/android/libs')) {
      return config; 
    }

    const patched = config.modResults.contents.replace(
      /allprojects\s*\{\s*repositories\s*\{/,
      (match) => `${match}\n    ${repoLine}`
    );

    if (patched === config.modResults.contents) {
      console.warn('[withNotifeeRepo] Could not locate allprojects.repositories block.');
    } else {
      console.log('[withNotifeeRepo] Injected Notifee local maven dependency node.');
    }

    config.modResults.contents = patched;
    return config;
  });
};
