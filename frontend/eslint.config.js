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
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "pulpe",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "pulpe",
          style: "kebab-case",
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
        typescript: { alwaysTryTypes: true },
      },
      "boundaries/dependency-nodes": ["import", "dynamic-import"],
      "boundaries/elements": [
        {
          type: "main",
          mode: "file",
          pattern: "main.ts",
          basePattern: "projects/**/src",
          baseCapture: ["app"],
        },
        {
          type: "app",
          mode: "file",
          pattern: "app*.ts",
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "core",
          pattern: "core",
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "ui",
          pattern: "ui",
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "layout",
          pattern: "layout",
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "pattern",
          pattern: "pattern",
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "feature-routes",
          mode: "file",
          pattern: "feature/*/*.routes.ts",
          capture: ["feature"],
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "feature",
          pattern: "feature/*",
          capture: ["feature"],
          basePattern: "projects/**/src/app",
          baseCapture: ["app"],
        },
        {
          type: "env",
          pattern: "environments",
          basePattern: "projects/**/src",
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
      ],
    },
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
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "ui",
              allow: [
                ["lib-api"],
                ["ui", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "layout",
              allow: [
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: "app",
              allow: [
                ["lib-api"],
                ["app", { app: "${from.app}" }],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["layout", { app: "${from.app}" }],
                ["feature-routes", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["pattern"],
              allow: [
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
                ["lib-api"],
                ["core", { app: "${from.app}" }],
                ["ui", { app: "${from.app}" }],
                ["pattern", { app: "${from.app}" }],
                ["env", { app: "${from.app}" }],
              ],
            },
            {
              from: ["feature-routes"],
              allow: [
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
              allow: [["lib", { app: "${from.lib}" }]],
            },
            {
              from: ["lib"],
              allow: [["lib", { app: "${from.lib}" }]],
            },
          ],
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
);
