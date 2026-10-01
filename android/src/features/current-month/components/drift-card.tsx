import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { SectionHeader } from "@/core/ui/section-header";
import { ICON_SIZE, RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import type { DriftLine } from "../current-month-view-model";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { useTranslation } from "@/core/i18n/locale-store";

/**
 * Fixed rather than derived: this is a dashboard summary, not the full list, and
 * a month that drifts on ten envelopes should not render ten bars tall —
 * precisely the month that most needs the dashboard to stay calm.
 */
const MAX_ROWS = 3;
const BAR_HEIGHT = 8;
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
  /** Opens the budget, where the envelopes can be adjusted. */
  onCatchUp?: () => void;
}

/**
 * Envelopes consumed past their plan, worst first, each with a bar measured
 * against the worst one. Absent when nothing drifts. The drift accent is a
 * burnt coral rather than the anxiety red — the overshoot is factual, not
 * punitive.
 */
export function DriftCard({
  drifts,
  totalOver,
  absorbsOverrun,
  currency,
  onCatchUp,
}: DriftCardProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const ripple = useRipple();
  const { t } = useTranslation();
  const driftColor = financial.drift;

  const shown = drifts.slice(0, MAX_ROWS);
  const hidden = drifts.length - shown.length;
  const worstOver = Math.max(
    ...shown.map((drift) => -drift.consumption.available),
    0,
  );

  return (
    <View style={styles.section}>
      <SectionHeader
        title={t("home.drift.title")}
        subtitle={t(
          absorbsOverrun ? "home.drift.summaryAbsorbed" : "home.drift.summary",
          { amount: formatCompactCurrency(totalOver, currency) },
        )}
      />

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {shown.map((drift, index) => {
          const overBy = -drift.consumption.available;
          return (
            <View
              key={drift.line.id}
              style={[
                styles.row,
                index > 0 && styles.divided,
                index > 0 && { borderTopColor: theme.colors.outlineVariant },
              ]}
            >
              <View style={styles.rowHeading}>
                <Text
                  variant="titleMedium"
                  numberOfLines={1}
                  style={styles.name}
                >
                  {drift.line.name}
                </Text>
                <Text
                  variant="labelLarge"
                  style={[TABULAR_DIGITS, { color: driftColor }]}
                >
                  {t("home.drift.overBy", {
                    amount: formatCompactAmount(overBy, currency),
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.track,
                  { backgroundColor: theme.colors.surfaceVariant },
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
          );
        })}

        {hidden > 0 && (
          <Text
            variant="labelLarge"
            style={[styles.hidden, { color: theme.colors.onSurfaceVariant }]}
          >
            {t("home.drift.hidden", { count: hidden })}
          </Text>
        )}

        {onCatchUp !== undefined && (
          <Pressable
            onPress={onCatchUp}
            android_ripple={ripple}
            accessibilityRole="button"
            style={[
              styles.footer,
              { borderTopColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.footerText}>
              <Text
                variant="titleSmall"
                style={{ color: theme.colors.primary }}
              >
                {t("home.drift.catchUp", {
                  amount: formatCompactCurrency(totalOver, currency),
                })}
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("home.drift.catchUpHint")}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={ICON_SIZE.md}
              color={theme.colors.primary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm + SPACING.xs },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + SPACING.xs,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth },
  rowHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  name: { flex: 1 },
  hidden: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  track: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.full },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1, gap: SPACING.xxs },
});
