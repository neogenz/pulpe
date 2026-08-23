const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  // `android/` et `ios/` sont générés par `expo prebuild` (jamais commités).
  { ignores: ["dist/*", ".expo/*", "android/*", "ios/*"] },
  // Le setup Jest tourne avant le framework de test : ses globales ne viennent
  // d'aucun import, et sans ça `no-undef` fait échouer `pnpm lint`.
  {
    files: ["jest.setup.js"],
    languageOptions: { globals: { jest: "readonly" } },
  },
]);
