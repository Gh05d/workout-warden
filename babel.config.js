const config = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};

if (process.env.USE_CONSOLE !== 'true') {
  config.plugins.push('transform-remove-console');
}

module.exports = config;
