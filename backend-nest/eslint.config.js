// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const nestjsTyped = require('@darraghor/eslint-plugin-nestjs-typed');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.d.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.ts'],
    plugins: {
      prettier: prettier,
    },
    rules: {
      // === PRETTIER INTEGRATION ===
      'prettier/prettier': 'error',

      // === NESTJS SPECIFIC RULES ===
      // NestJS-typed plugin rules will be added later once we verify available rules

      // === TYPESCRIPT BASIC RULES ===
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/prefer-as-const': 'error',

      // === BASIC NAMING CONVENTIONS ===
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
          selector: 'typeAlias',
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
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
      ],

      // === CODE QUALITY RULES ===
      complexity: ['warn', 15],
      'max-lines-per-function': ['warn', 50],
      'max-params': ['warn', 7],
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-duplicate-imports': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-unused-private-class-members': 'off',

      // === NESTJS ARCHITECTURAL RULES ===
      '@typescript-eslint/explicit-function-return-type': 'off', // Trop strict pour les contrôleurs NestJS
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Trop strict pour NestJS
      '@typescript-eslint/no-extraneous-class': 'off', // Modules NestJS ont souvent des classes vides
    },
  },

  // === TEST FILES SPECIFIC RULES ===
  {
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/test/**/*.ts'],
    rules: {
      // Tests plus permissifs
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-params': 'off',
      'no-console': 'off',
      complexity: 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
