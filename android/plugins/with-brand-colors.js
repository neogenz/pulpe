const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
} = require("expo/config-plugins");

const { assignColorValue } = AndroidConfig.Colors;
const { assignStylesValue, getAppThemeGroup } = AndroidConfig.Styles;

/** `primary` in `src/core/ui/theme.ts`, which the JS side already paints with. */
const PRIMARY_LIGHT = "#006E25";
const PRIMARY_DARK = "#7EDB83";

/**
 * Paints the dialogs Android draws for us in Pulpe's green.
 *
 * A handful of surfaces never pass through React: the date picker, the text
 * selection handles, the caret. They take their colour from the Android theme,
 * which `expo prebuild` writes with the template's `#023c69` and leaves
 * `AppCompat`'s teal for the accent — so the date picker in a green app opened
 * with a blue header and teal buttons.
 *
 * A plugin rather than an edit to `android/`: the native project is generated,
 * and `prebuild` would take the edit back out with it.
 */
module.exports = function withBrandColors(config) {
  const withLight = withAndroidColors(config, (modified) => {
    modified.modResults = assignColorValue(modified.modResults, {
      name: "colorPrimary",
      value: PRIMARY_LIGHT,
    });
    modified.modResults = assignColorValue(modified.modResults, {
      name: "colorAccent",
      value: PRIMARY_LIGHT,
    });
    return modified;
  });

  const withDark = withAndroidColorsNight(withLight, (modified) => {
    modified.modResults = assignColorValue(modified.modResults, {
      name: "colorPrimary",
      value: PRIMARY_DARK,
    });
    modified.modResults = assignColorValue(modified.modResults, {
      name: "colorAccent",
      value: PRIMARY_DARK,
    });
    return modified;
  });

  // `colorPrimary` is already declared by the template; the accent is not, and
  // an undeclared accent is the teal.
  return withAndroidStyles(withDark, (modified) => {
    modified.modResults = assignStylesValue(modified.modResults, {
      add: true,
      name: "colorAccent",
      value: "@color/colorAccent",
      parent: getAppThemeGroup(),
    });
    return modified;
  });
};
