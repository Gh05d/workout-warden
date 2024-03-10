module.exports = {
  root: true,
  extends: ['@react-native', 'prettier'],
  parserOptions: {ecmaVersion: 2020, ecmaFeatures: {jsx: true}},
  rules: {
    'prettier/prettier': ['error', {endOfLine: 'auto'}],
    eqeqeq: 'off',
    'object-curly-spacing': [0, 'always'],
    'array-bracket-spacing': [1, 'never'],
    'max-lines': [1, 500],
    'prefer-destructuring': [1],
    'react/jsx-filename-extension': [1, {extensions: ['.jsx', 'tsx']}],
    endOfLine: 0,
    curly: 'off',
    'react-native/no-inline-styles': 'off',
    'react-hooks/exhaustive-deps': [
      'error',
      {
        additionalHooks: '(useAnimatedStyle|useDerivedValue|useAnimatedProps)',
      },
    ],
  },
};
