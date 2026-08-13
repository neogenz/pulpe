// @ts-check
const path = require("path");
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const boundaries = require("eslint-plugin-boundaries");

module.exports = tseslint.config(
  {
    ignores: ["**/*.d.ts"],
  },
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
      "boundaries/legacy-templates": false,
      "boundaries/root-path": path.resolve(__dirname, ".."),
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
      "boundaries/element-types": "off",
      "boundaries/entry-point": "off",
      "boundaries/external": "off",
      "boundaries/no-private": "off",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: { type: "main" },
              allow: [
                {
                  to: {
                    type: "app",
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
                {
                  to: {
                    type: "env",
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "core" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["core", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "ui" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["ui", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "layout" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["core", "ui", "layout", "pattern", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "app" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: [
                      "app",
                      "core",
                      "ui",
                      "layout",
                      "pattern",
                      "feature-routes",
                      "feature",
                      "env",
                    ],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "pattern" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["core", "ui", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              from: { type: "feature" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["core", "ui", "pattern", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
                {
                  to: {
                    type: "feature",
                    captured: {
                      app: "{{ from.captured.app }}",
                      feature: "{{ from.captured.feature }}",
                    },
                  },
                },
              ],
            },
            {
              from: { type: "feature-routes" },
              allow: [
                { to: { type: ["shared", "lib-api"] } },
                {
                  to: {
                    type: ["core", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
                {
                  to: {
                    type: ["pattern", "feature"],
                    captured: {
                      app: "{{ from.captured.app }}",
                      feature: "{{ from.captured.feature }}",
                    },
                  },
                },
                {
                  to: {
                    type: "feature-routes",
                    captured: {
                      app: "{{ from.captured.app }}",
                      feature: "!{{ from.captured.feature }}",
                    },
                  },
                },
              ],
            },
            {
              from: { type: "lib-api" },
              allow: [
                {
                  to: {
                    type: "lib",
                    captured: { lib: "{{ from.captured.lib }}" },
                  },
                },
              ],
            },
            {
              from: { type: "lib" },
              allow: [
                {
                  to: {
                    type: "lib",
                    captured: { lib: "{{ from.captured.lib }}" },
                  },
                },
              ],
            },
            {
              from: { type: "test-config" },
              // `testing` for the stubs the suite needs installed before any
              // spec runs — the pinned browser language, whose only other home
              // would be a copy of itself inside test-setup.ts.
              allow: [{ to: { type: ["lib-api", "testing"] } }],
            },
            {
              from: { type: "e2e-config" },
              allow: [{ to: { type: "lib-api" } }],
            },
            {
              from: { type: "e2e" },
              allow: [{ to: { type: ["e2e", "lib-api", "shared"] } }],
            },
            {
              from: { type: "testing" },
              allow: [{ to: { type: "shared" } }],
            },
            {
              from: { type: "script" },
              allow: [{ to: { type: ["shared", "core", "lib-api"] } }],
            },
            {
              from: { type: "test-spec" },
              allow: [
                { to: { type: ["shared", "lib-api", "testing"] } },
                // e2e *.spec.ts files also classify as `test-spec`; they import
                // their fixtures/helpers (type `e2e`). Permit it here rather than
                // re-typing e2e specs (which destabilises unit-spec matching).
                { to: { type: "e2e" } },
                {
                  to: {
                    type: ["core", "ui", "layout", "pattern", "feature", "env"],
                    captured: { app: "{{ from.captured.app }}" },
                  },
                },
              ],
            },
            {
              disallow: {
                to: { parent: { type: "*" } },
                dependency: {
                  relationship: {
                    to: [null, "!(child|sibling|uncle)"],
                  },
                },
              },
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
