const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  // `android/` et `ios/` sont générés par `expo prebuild` (jamais commités).
  { ignores: ["dist/*", ".expo/*", "android/*", "ios/*"] },
]);
