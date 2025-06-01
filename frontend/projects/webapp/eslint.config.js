// @ts-check
const tseslint = require("typescript-eslint");
const rootConfig = require("../../eslint.config.js");

module.exports = tseslint.config(
  ...rootConfig,
  {
    files: ["**/*.ts"],
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
      // Disable class suffix rules in accordance with Angular v20 style guide
      "@angular-eslint/component-class-suffix": "off",
      "@angular-eslint/directive-class-suffix": "off",
      "@angular-eslint/pipe-class-suffix": "off",
    },
  },
  {
    files: ["**/*.html"],
    rules: {},
  },
);
