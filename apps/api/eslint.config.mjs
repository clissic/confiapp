import nodeConfig from '@confiapp/config/eslint/node';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nodeConfig,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
    },
  },
];
