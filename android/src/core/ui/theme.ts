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
    error: "#D4760A",
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
  },
  dark: {
    income: "#5AA8E0",
    expense: "#F0A050",
    savings: "#50C882",
    overBudget: "#E5A33A",
    destructive: "#FF6B6B",
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

export const pulpeLightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: RADIUS.sm,
  colors: { ...MD3LightTheme.colors, ...PALETTE.light },
  fonts: configureFonts({ config: pulpeFonts(MD3LightTheme.fonts) }),
};

export const pulpeDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: RADIUS.sm,
  colors: { ...MD3DarkTheme.colors, ...PALETTE.dark },
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
