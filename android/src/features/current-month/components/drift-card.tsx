import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import {
  HOME_HERO_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import type { DriftLine } from "../current-month-view-model";

/**
 * Fixed rather than derived: this is a dashboard summary, not the full list, and
 * a month that drifts on ten envelopes should not render ten bars tall —
 * precisely the month that most needs the dashboard to stay calm.
 */
const MAX_ROWS = 3;
const BAR_HEIGHT = 6;
const PERCENT = 100;

interface DriftCardProps {
  drifts: DriftLine[];
  totalOver: number;
  /**
   * The hero's own verdict. A month that landed on or above its plan says the
   * excess was covered elsewhere rather than asserting the hero's opposite.
   */
  absorbsOverrun: boolean;
  currency: SupportedCurrency;
}

/** Envelopes consumed past their plan, worst first. Absent when nothing drifts. */
export function DriftCard({
  drifts,
  totalOver,
  absorbsOverrun,
  currency,
}: DriftCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const driftColor = HOME_HERO_COLORS[scheme].drift;

  const shown = drifts.slice(0, MAX_ROWS);
  const hidden = drifts.length - shown.length;
  // The bar's denominator is the worst row on the card, so a row's length
  // compares its francs to the worst overrun rather than to its own envelope —
  // which shrank the biggest loss into the smallest bar.
  const worstOver = Math.max(
    ...shown.map((drift) => -drift.consumption.available),
    0,
  );

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <Text variant="titleSmall">Ça dérive</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {`${formatCompactCurrency(totalOver, currency)} au-delà du plan${
            absorbsOverrun ? ", compensé ailleurs ce mois" : ""
          }`}
        </Text>
      </View>

      <View
        style={[styles.rows, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        {shown.map((drift, index) => {
          const overBy = -drift.consumption.available;
          return (
            <View key={drift.line.id}>
              {index > 0 && <Divider />}
              <View style={styles.row}>
                <View style={styles.rowHeading}>
                  <Text variant="bodyMedium" numberOfLines={1}>
                    {drift.line.name}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={[TABULAR_DIGITS, { color: driftColor }]}
                  >
                    {`+${formatCompactAmount(overBy, currency)} en trop`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: theme.colors.outlineVariant },
                  ]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        backgroundColor: driftColor,
                        width: `${worstOver > 0 ? (overBy / worstOver) * PERCENT : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {hidden > 0 && (
          <>
            <Divider />
            <Text
              variant="labelMedium"
              style={[styles.row, { color: theme.colors.onSurfaceVariant }]}
            >
              {`+${hidden} autre${hidden > 1 ? "s" : ""} enveloppe${hidden > 1 ? "s" : ""}`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm },
  heading: { gap: SPACING.xxs },
  rows: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
  },
  row: { paddingVertical: SPACING.md, gap: SPACING.sm },
  rowHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  track: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: RADIUS.xs,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.xs },
});
