// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'node_modules/**', '*.js'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // === TYPESCRIPT BASIC RULES ===
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',

      // === NAMING CONVENTIONS (basiques) ===
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
        },
      ],

      // === CODE QUALITY RULES (progressives) ===
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', 50],
      'max-params': ['warn', 7],
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // === NESTJS BASIC RULES ===
      '@typescript-eslint/explicit-function-return-type': 'off', // Trop strict pour commencer
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },

  // === TEST FILES SPECIFIC RULES ===
  {
    files: ['**/*.spec.ts'],
    rules: {
      // Tests plus permissifs
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-params': 'off',
      'no-console': 'off',
      complexity: 'off',
    },
  }
);
