import type { ReactNode } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { TABULAR_DIGITS } from "@/core/ui/theme";
import { useFinancialColors } from "@/core/ui/scheme-colors";

/**
 * How loudly an amount speaks, which is a question about the screen and not
 * about the number. The app used to answer it seven ways — `titleMedium`,
 * `bodyLarge`, `bodyMedium`, `bodySmall`, `labelLarge`, `labelMedium`,
 * `labelSmall` — so the same 340 CHF changed weight between two screens that
 * were showing it for the same reason, and the eye re-learned the hierarchy at
 * every surface.
 *
 * `hero` is the one number a screen exists to show. `row` is an amount in a
 * list, the majority case. `meta` is an amount that qualifies another one.
 */
const SIZES = {
  hero: "displaySmall",
  row: "titleMedium",
  meta: "labelLarge",
} as const;

/**
 * What the amount *is*, not what colour to paint it. `neutral` is ink, for an
 * amount whose sign is the whole story; `muted` steps back without dimming,
 * for a figure that qualifies the one beside it.
 */
type Tone =
  | "neutral"
  | "muted"
  | "income"
  | "expense"
  | "savings"
  | "overBudget";

interface AmountProps {
  /** The formatted amount. Formatting stays with the formatters, and so does masking. */
  children: ReactNode;
  size: keyof typeof SIZES;
  tone?: Tone;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * An amount, in one of three voices, with tabular figures and its financial
 * accent already applied. `style` is for layout — a margin, an alignment — and
 * not for taking the typography back.
 */
export function Amount({
  children,
  size,
  tone = "neutral",
  numberOfLines,
  style,
}: AmountProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const color =
    tone === "neutral"
      ? theme.colors.onSurface
      : tone === "muted"
        ? theme.colors.onSurfaceVariant
        : financial[tone];
  // A hero is one line that shrinks to fit, always: it is the largest type on
  // the screen, and the one amount big enough to wrap is a seven-figure balance
  // — the moment the screen can least afford to reflow around it.
  const isHero = size === "hero";

  return (
    <Text
      variant={SIZES[size]}
      numberOfLines={isHero ? 1 : numberOfLines}
      adjustsFontSizeToFit={isHero}
      style={[TABULAR_DIGITS, { color }, style]}
    >
      {children}
    </Text>
  );
}
