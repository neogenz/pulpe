// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const boundaries = require("eslint-plugin-boundaries");

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // Simple import ordering that's fully auto-fixable
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    plugins: { boundaries },
    extends: [boundaries.configs.strict],
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json", "./projects/webapp/tsconfig.app.json"],
        },
      },
      "boundaries/dependency-nodes": ["import", "dynamic-import"],
      "boundaries/root-path": "..",
      "boundaries/elements": [
        {
          type: "shared",
          pattern: "shared/**/*",
          mode: "file",
        },
        {
          type: "main",
          mode: "file",
          pattern: "main.ts",
          basePattern: "frontend/projects/**/src",
          baseCapture: ["app"],
        },
        {
          type: "app",
          mode: "file",
          pattern: "app/app*.ts",
          basePattern: "frontend/projects/**/src",
          baseCapture: ["app"],
        },
        {
          type: "core",
          pattern: "core/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "ui",
          pattern: "ui/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "layout",
          pattern: "layout/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "pattern",
          pattern: "pattern/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "feature-routes",
          mode: "file",
          pattern: "feature/([^/]+)/*.routes.ts",
          capture: ["feature"],
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "feature",
          pattern: "feature/([^/]+)/**/*",
          mode: "file",
          capture: ["feature"],
          basePattern: "frontend/projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "env",
          pattern: "environments/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src",
          baseCapture: ["app"],
        },
        {
          type: "lib-api",
          mode: "file",
          pattern: "projects/**/src/public-api.ts",
          capture: ["lib"],
        },
        {
          type: "lib",
          pattern: "projects/**/src/lib",
          capture: ["lib"],
        },
        {
          type: "test-config",
          mode: "file",
          pattern: ["vitest.config.ts", "projects/**/test-setup.ts"],
        },
        {
          type: "e2e-config",
          mode: "file",
          pattern: "playwright.config.ts",
        },
        {
          type: "e2e",
          mode: "file",
          pattern: "e2e/**/*.ts",
        },
        {
          type: "script",
          mode: "file",
          pattern: "scripts/**/*.ts",
        },
        {
          type: "test-spec",
          mode: "file",
          pattern: "**/*.spec.ts",
          basePattern: "frontend/projects/**/src",
          baseCapture: ["app"],
        },
        {
          type: "testing",
          pattern: "testing/**/*",
          mode: "file",
          basePattern: "frontend/projects/**/src",
          baseCapture: ["app"],
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  },
  {
    files: ["**/*.ts"],
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: "main",
              allow: [
                ["app", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "core",
              allow: [
                ["shared"],
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "ui",
              allow: [
                ["shared"],
                ["lib-api"],
                ["ui", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "layout",
              allow: [
                ["shared"],
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["layout", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "app",
              allow: [
                ["shared"],
                ["lib-api"],
                ["app", { app: "${from.app}" }],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["layout", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["feature-routes", { app: "${from.app}" }],
                ["feature", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["pattern"],
              allow: [
                ["shared"],
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["feature"],
              allow: [
                ["shared"],
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["feature", { app: "${from.app}", feature: "${from.feature}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["feature-routes"],
              allow: [
                ["shared"],
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}", feature: "${from.feature}" }],
                ["feature", { app: "${from.app}", feature: "${from.feature}" }],
                [
                  "feature-routes",
                  { app: "${from.app}", feature: "!${from.feature}" },
                ],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["lib-api"],
              allow: [["lib", { lib: "${from.lib}" }]],
            },
            {
              from: ["lib"],
              allow: [["lib", { lib: "${from.lib}" }]],
            },
            {
              from: ["test-config"],
              allow: [["lib-api"]],
            },
            {
              from: ["e2e-config"],
              allow: [["lib-api"]],
            },
            {
              from: ["e2e"],
              allow: [["e2e"], ["lib-api"], ["shared"]],
            },
            {
              from: ["testing"],
              allow: ["shared"],
            },
            {
              from: ["script"],
              allow: [["shared"], ["core"], ["lib-api"]],
            },
            {
              from: ["test-spec"],
              allow: [
                ["shared"],
                ["lib-api"],
                ["testing"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["layout", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["feature", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
          ],
        },
      ],
      // Disable class suffix rules in accordance with Angular v20 style guide
      "@angular-eslint/component-class-suffix": "off",
      "@angular-eslint/directive-class-suffix": "off",
      "@angular-eslint/pipe-class-suffix": "off",
      // Disable floating promises rule until type-aware linting is properly configured
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  // Configuration spécifique pour les fichiers de test E2E
  {
    files: ["e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./e2e/tsconfig.json",
      },
    },
    rules: {
      // Renforcer la règle no-floating-promises pour les tests E2E
      "@typescript-eslint/no-floating-promises": "error",
      // Permettre l'usage de any dans les tests pour les mocks
      "@typescript-eslint/no-explicit-any": "warn",
      // Les tests peuvent avoir des fonctions longues
      "max-lines-per-function": "off",
    },
  },
);
