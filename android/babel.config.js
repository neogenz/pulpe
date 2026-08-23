// Metro injecte `babel-preset-expo` tout seul ; ce fichier existe pour `babel-jest`,
// qui refuse de parser le Flow des paquets React Native sans config Babel sur disque.
// `babel-preset-expo` embarque le plugin Reanimated/Worklets depuis le SDK 54.
module.exports = function babelConfig(api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
