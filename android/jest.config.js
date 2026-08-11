/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo/android",
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  setupFiles: ["<rootDir>/jest.setup.js"],
};
