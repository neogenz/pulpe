import type { TextStyle } from "react-native";
import {
  configureFonts,
  MD3DarkTheme,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";

/**
 * Pulpe on Material 3.
 *
 * The palette is already expressed in MD3 roles — `DESIGN.md` names primary,
 * secondary and tertiary, and the webapp runs on Angular Material — so a MD3
 * kit carries the direction artistique rather than fighting it. Seeds named in
 * the root `DESIGN.md` win; roles it leaves to the platforms take the values
 * `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift` already resolved, so the two
 * native apps render the same surface ladder.
 */

const PALETTE = {
  light: {
    primary: "#006E25",
    onPrimary: "#FFFFFF",
    primaryContainer: "#99F89D",
    onPrimaryContainer: "#00531A",

    secondary: "#406741",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#C1EEBE",
    onSecondaryContainer: "#00210B",

    tertiary: "#0061A6",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#D2E4FF",
    onTertiaryContainer: "#001D36",

    background: "#F7F6F3",
    onBackground: "#1A1C19",
    surface: "#FFFFFF",
    onSurface: "#1A1C19",
    surfaceVariant: "#EBE9E5",
    onSurfaceVariant: "#524D48",

    outline: "#6F7A6D",
    outlineVariant: "#BFCABA",

    // Amber, not red: a form error is not a punishment. True red is reserved
    // for irreversible actions, exposed below as `destructive`.
    //
    // Darkened from the `#D4760A` this opened on, which measured 3.28:1 on
    // `surface` and 2.71:1 on `surfaceVariant`. Paper wires this role into
    // every `HelperText`, so the screen where someone is already stuck was the
    // one whose message they could least read. Tuned the way `overBudget`
    // below was — same hue, moved until it clears 4.5:1 on the darkest
    // background it lands on.
    error: "#9A5500",
    onError: "#FFFFFF",
    errorContainer: "#FFF3E0",
    onErrorContainer: "#3A2510",

    inverseSurface: "#2F312D",
    inverseOnSurface: "#F0F1EC",
    inversePrimary: "#7EDB83",
  },
  dark: {
    primary: "#7EDB83",
    onPrimary: "#0A1F0D",
    primaryContainer: "#00531A",
    onPrimaryContainer: "#99F89D",

    secondary: "#A6D2A3",
    onSecondary: "#0D260F",
    secondaryContainer: "#294F2B",
    onSecondaryContainer: "#C1EEBE",

    tertiary: "#6BAAEE",
    onTertiary: "#00325A",
    tertiaryContainer: "#00497F",
    onTertiaryContainer: "#D2E4FF",

    background: "#141210",
    onBackground: "#E5E2DD",
    surface: "#1A1816",
    onSurface: "#E5E2DD",
    surfaceVariant: "#242220",
    onSurfaceVariant: "#B8B0A8",

    outline: "#899486",
    outlineVariant: "#3F493E",

    error: "#F0A050",
    onError: "#3A2510",
    errorContainer: "#3A2510",
    onErrorContainer: "#F0A050",

    inverseSurface: "#E5E2DD",
    inverseOnSurface: "#2F312D",
    inversePrimary: "#006E25",
  },
} as const;

/**
 * Semantic financial accents. They are not MD3 roles: MD3 has no vocabulary for
 * "this amount is income", and mapping them onto tertiary/secondary would make
 * the palette lie about meaning — see the Color Means Something Rule.
 *
 * `overBudget` keeps the iOS light value rather than the `DESIGN.md` seed: it
 * is tuned to clear 4.5:1 on the hero's mint surface, the darkest background it
 * lands on.
 */
export const FINANCIAL_COLORS = {
  light: {
    income: "#0061A6",
    expense: "#B35800",
    savings: "#157038",
    overBudget: "#905800",
    /** Irreversible actions only — never over-budget feedback. */
    destructive: "#C62828",
    /** The surface an irreversible action sits on, from `Color+Pulpe.swift`. */
    destructiveContainer: "#FDECEA",
  },
  dark: {
    income: "#5AA8E0",
    expense: "#F0A050",
    savings: "#50C882",
    overBudget: "#E5A33A",
    destructive: "#FF6B6B",
    destructiveContainer: "#3A1818",
  },
} as const;

/**
 * The home dashboard's mint hero card, from `Color+Pulpe.swift`. Its surface is
 * the same in every emotion state — the brand stays calm and the verdict is
 * carried by the ink on it, not by the card turning colour underneath.
 *
 * `drift` is the deficit accent, set against this mint rather than against the
 * app background, which is where it has to clear 4.5:1.
 */
export const HOME_HERO_COLORS = {
  light: {
    surface: "#CFE8D6",
    ink: "#0E3A1C",
    support: "#2C5136",
    drift: "#AA4522",
  },
  dark: {
    surface: "#1D3A28",
    ink: "#D5ECDC",
    support: "#9FC3AA",
    drift: "#E8825A",
  },
} as const;

/** Hero gradient tints, keyed to financial state. The only red-adjacent surface. */
export const HERO_TINTS = {
  comfortable: "#14AD45",
  tight: "#D88010",
  deficit: "#C45028",
} as const;

/** Mirrors `DesignTokens.Spacing` on iOS so both apps share one rhythm. */
export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/**
 * Material's minimum touch target, which is 48 and not the 44 iOS asks for. The
 * distinction matters on the controls both apps share: a ring sized to Apple's
 * floor is four points short of Android's, and no amount of `hitSlop` was ever
 * going to be added to a control that had already declared itself compliant.
 */
export const TOUCH_TARGET = 48;

/**
 * How much of an accent a surface takes when tinted by it, as a hex alpha
 * suffix. `surface` is M3's own pressed-state opacity, which is also what a
 * ripple lays over the thing it is acknowledging; `icon` is the shade a disc
 * needs to read as a disc behind a glyph of the same colour.
 */
export const TINT_ALPHA = { subtle: "14", surface: "1F", icon: "26" } as const;

/**
 * Every icon in the app is one of these five. The ladder is the Material one,
 * and the sizes between its rungs — 13, 14, 18, 22, 28 — were each a judgement
 * call made once, in one file, against nothing.
 */
export const ICON_SIZE = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 } as const;

/**
 * The only two opacities allowed to dim anything, and neither dims text that
 * still has to be read: 0.72 laid over a whole card took its metadata to
 * 3.64:1. `pending` is worn for the length of a request, `disabled` by a
 * control with no contrast contract left to keep — M3's own value.
 */
export const EMPHASIS = { pending: 0.5, disabled: 0.38 } as const;

/**
 * How long anything is allowed to take, in milliseconds. M3's `short4` and
 * `medium2`: `short` for something rearranging itself in place, `medium` for
 * something arriving or leaving. Longer than this and the app is asking to be
 * waited for; shorter and the eye reads a cut rather than a movement, which is
 * the whole reason a line that gets pointed used to vanish between two frames.
 */
export const DURATION = { short: 200, medium: 300 } as const;

/**
 * The margin Paper hangs off every side of an `IconButton`. Subtract it from a
 * gutter to line the icon's *glyph* up with the text below it, rather than its
 * invisible box — otherwise the button sits six points proud of the column.
 */
export const ICON_BUTTON_INSET = 6;

/**
 * Letter-spacing for a label set in capitals. Capitals lose the word-shape the
 * eye reads by, and without the extra tracking they close up into a block.
 */
export const UPPERCASE_TRACKING = 2;

/**
 * The gutter every screen keeps between its content and the display edge.
 * A horizontal rail is the exception: it runs edge to edge and applies this to
 * its *content* instead, so the first and last item can scroll past the gutter
 * rather than being clipped by it.
 */
export const SCREEN_PADDING = SPACING.md;

/**
 * What a list must leave under its last row so a floating action button does
 * not sit on top of it: 56 for the button, 16 for its margin, 24 to read past.
 */
export const FAB_CLEARANCE = 96;

/**
 * The icon size an `IconButton` takes when it sits at the end of a list row.
 * Paper's default sizes the button at 1.5× its icon and hangs six points of
 * margin off every side, so a pencil and a bin together cost a hundred of the
 * three hundred and sixty a row has to give — enough to truncate the name while
 * the amount column is still half empty, and to make the row half again as tall
 * as the text in it. Pair it with `margin: 0` on the button's own style.
 *
 * The 36dp this renders is the drawing, not the target: Paper's `IconButton`
 * hands its `TouchableRipple` a 10dp `hitSlop` on Android, so the button answers
 * across 56 and clears `TOUCH_TARGET` without being widened. Passing a `hitSlop`
 * of your own here would replace that one and shrink the target.
 */
export const ROW_ACTION_ICON_SIZE = ICON_SIZE.md;

/** Mirrors `DesignTokens.CornerRadius` on iOS. */
export const RADIUS = {
  xs: 4,
  sm: 8,
  card: 18,
  md: 24,
  full: 999,
} as const;

const DISPLAY_FAMILY = "Manrope";

/**
 * Two families, per the Two-Family Rule. Manrope carries the brand on display
 * and headline sizes; everything that is chrome — titles, body, labels,
 * buttons — stays on the Android system font, which is what SF Pro is to iOS.
 */
function pulpeFonts(base: MD3Theme["fonts"]): MD3Theme["fonts"] {
  const brandVariants = [
    "displayLarge",
    "displayMedium",
    "displaySmall",
    "headlineLarge",
    "headlineMedium",
    "headlineSmall",
  ] as const;

  const fonts = { ...base };
  for (const variant of brandVariants) {
    fonts[variant] = {
      ...base[variant],
      fontFamily: DISPLAY_FAMILY,
      fontWeight: "800",
    };
  }
  return fonts;
}

/** How much of the tint M3 lays over the surface, at levels 1 through 5. */
const ELEVATION_TINT_OPACITIES = [0.05, 0.08, 0.11, 0.12, 0.14] as const;
const HEX_CHANNEL_STARTS = [1, 3, 5] as const;
const HEX_RADIX = 16;
const HEX_CHANNEL_LENGTH = 2;

/**
 * MD3's elevation ladder is its baseline purple mixed into its baseline
 * surface, and overriding `colors` leaves that ladder untouched — which is how
 * a `Searchbar`, whose view mode sits on level 3, opened lilac in a green app.
 * Every elevated Paper surface reads from it: menus, dialogs, snackbars.
 *
 * Rebuilt from the palette's own surface and primary, in M3's proportions.
 */
export function elevationLadder(
  surface: string,
  tint: string,
): MD3Theme["colors"]["elevation"] {
  const [level1, level2, level3, level4, level5] = ELEVATION_TINT_OPACITIES.map(
    (opacity) => mixHex(surface, tint, opacity),
  );

  // Level 0 is the absence of elevation, not a colour of its own.
  return { level0: "transparent", level1, level2, level3, level4, level5 };
}

function mixHex(base: string, overlay: string, ratio: number): string {
  const channels = HEX_CHANNEL_STARTS.map((start) => {
    const read = (hex: string) =>
      parseInt(hex.slice(start, start + HEX_CHANNEL_LENGTH), HEX_RADIX);
    return Math.round(read(base) * (1 - ratio) + read(overlay) * ratio);
  });

  return `#${channels.map((value) => value.toString(HEX_RADIX).padStart(HEX_CHANNEL_LENGTH, "0")).join("")}`;
}

export const pulpeLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: RADIUS.sm,
  colors: {
    ...MD3LightTheme.colors,
    ...PALETTE.light,
    elevation: elevationLadder(PALETTE.light.surface, PALETTE.light.primary),
  },
  fonts: configureFonts({ config: pulpeFonts(MD3LightTheme.fonts) }),
};

export const pulpeDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: RADIUS.sm,
  colors: {
    ...MD3DarkTheme.colors,
    ...PALETTE.dark,
    elevation: elevationLadder(PALETTE.dark.surface, PALETTE.dark.primary),
  },
  fonts: configureFonts({ config: pulpeFonts(MD3DarkTheme.fonts) }),
};

/**
 * Amounts use tabular figures everywhere, so digits stop wobbling between
 * updates — the Tabular Digits Rule. Applied through a style rather than a
 * component so it composes with whatever renders the amount.
 */
export const TABULAR_DIGITS: TextStyle = {
  fontVariant: ["tabular-nums"],
};
