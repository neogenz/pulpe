import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Divider, List, Text, useTheme } from "react-native-paper";

import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { RADIUS, SPACING } from "@/core/ui/theme";

import type { DriftLine } from "../current-month-view-model";
import { Amount } from "@/core/ui/amount";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { useTranslation } from "@/core/i18n/locale-store";

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

/**
 * Envelopes consumed past their plan, worst first, as plain rows on the page:
 * secondary news, so it wears no surface of its own. Absent when nothing
 * drifts.
 */
export function DriftCard({
  drifts,
  totalOver,
  absorbsOverrun,
  currency,
}: DriftCardProps) {
  const theme = useTheme();
  const hero = useHeroColors();
  const { t } = useTranslation();
  const driftColor = hero.drift;

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
    <View style={styles.section}>
      <List.Subheader style={styles.subheader}>
        {t("home.drift.title")}
      </List.Subheader>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t(
          absorbsOverrun ? "home.drift.summaryAbsorbed" : "home.drift.summary",
          { amount: formatCompactCurrency(totalOver, currency) },
        )}
      </Text>

      {shown.map((drift, index) => {
        const overBy = -drift.consumption.available;
        return (
          <View key={drift.line.id}>
            {index > 0 && <Divider />}
            <List.Item
              title={drift.line.name}
              titleNumberOfLines={1}
              style={styles.item}
              description={() => (
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
              )}
              right={() => (
                <Amount size="meta" style={{ color: driftColor }}>
                  {t("home.drift.overBy", {
                    amount: formatCompactAmount(overBy, currency),
                  })}
                </Amount>
              )}
            />
          </View>
        );
      })}

      {hidden > 0 && (
        <>
          <Divider />
          <Text
            variant="labelMedium"
            style={[styles.hidden, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("home.drift.hidden", { count: hidden })}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.xs },
  // Paper pads its list chrome to its own gutter; the page already has one.
  subheader: { paddingHorizontal: 0, paddingVertical: 0 },
  item: { paddingHorizontal: 0 },
  hidden: { paddingVertical: SPACING.sm },
  track: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    marginTop: SPACING.xs,
    borderRadius: RADIUS.xs,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.xs },
});
