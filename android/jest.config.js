/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo/android",
  watchman: false,
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.spec.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/core/testing/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "json-summary", "lcov"],
  coverageThreshold: {
    global: { statements: 46, branches: 44, functions: 39, lines: 45 },
    "./src/core/auth/session-store.ts": {
      statements: 92,
      branches: 78,
      functions: 96,
      lines: 93,
    },
    "./src/core/vault/vault-store.ts": {
      statements: 80,
      branches: 100,
      functions: 60,
      lines: 80,
    },
    "./src/core/api/api-client.ts": {
      statements: 90,
      branches: 80,
      functions: 61,
      lines: 91,
    },
  },
};
