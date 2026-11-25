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
  // Le Menu de Paper laisse passer Retour à l'écran derrière lui.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/core/ui/menu.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native-paper",
              importNames: ["Menu"],
              message: "Importer Menu depuis @/core/ui/menu.",
            },
          ],
        },
      ],
    },
  },
]);
