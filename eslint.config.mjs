import globals from 'globals';
import pluginReact from 'eslint-plugin-react';
import pluginPrettier from 'eslint-plugin-prettier';
import pluginTypescript from '@typescript-eslint/eslint-plugin';
import parserTypescript from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'], // Target JavaScript and TypeScript files
    languageOptions: {
      parser: parserTypescript,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      react: pluginReact,
      prettier: pluginPrettier,
      '@typescript-eslint': pluginTypescript,
    },
    rules: {
      'prettier/prettier': 'error', // Use Prettier as an ESLint rule
      'react/react-in-jsx-scope': 'off', // Not required in React 17+
      '@typescript-eslint/no-unused-vars': 'warn', // Warn for unused variables
    },
    settings: {
      react: {
        version: 'detect', // Automatically detect React version
      },
    },
  },
  {
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      ...pluginPrettier.configs.recommended.rules,
    },
  },
];
