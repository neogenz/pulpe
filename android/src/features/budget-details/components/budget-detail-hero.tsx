import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { BudgetFormulas, SupportedCurrency } from "pulpe-shared";
import { CURRENCY_METADATA } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";

import {
  formatAmount,
  formatCurrency,
  formatSignedCurrency,
} from "@/core/ui/amount-format";
import { Amount } from "@/core/ui/amount";
import { ofMonth } from "@/core/ui/date-format";
import { Eyebrow } from "@/core/ui/eyebrow";
import { FadingRail } from "@/core/ui/fading-rail";
import { Pill } from "@/core/ui/pill";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, RADIUS, SCREEN_PADDING, SPACING } from "@/core/ui/theme";

import { budgetUsagePercentage } from "../budget-details-selectors";

const PERCENT = 100;
/** Amounts are shown to the centime, so that is the precision that counts. */
const CENTIMES_PER_UNIT = 100;

type Metrics = ReturnType<typeof BudgetFormulas.calculateAllMetrics>;

interface BudgetDetailHeroProps {
  metrics: Metrics;
  currency: SupportedCurrency;
  /** Non-zero when the month opened on last month's carry-over. */
  rollover: number;
  /** Names the month the carry-over came from, when that budget is known. */
  previousMonthName: string | null;
  onPressMetrics: () => void;
  /** Opens the month the carry-over came from, when there is one to open. */
  onPressRollover?: () => void;
}

/**
 * Flat on the page rather than a card: the dashboard already owns the mint hero,
 * and a second one here would read as a second verdict. The number is the whole
 * point, so nothing competes with it.
 */
export function BudgetDetailHero({
  metrics,
  currency,
  rollover,
  previousMonthName,
  onPressMetrics,
  onPressRollover,
}: BudgetDetailHeroProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const isDeficit = metrics.remaining < 0;
  const usagePercentage = budgetUsagePercentage(metrics);
  const usage = Math.min(Math.max(usagePercentage, 0), PERCENT);
  // Rounded to what the eye will read: a residual centime would print a
  // disclosure announcing an amount it then shows as zero.
  const hasRollover = Math.round(rollover * CENTIMES_PER_UNIT) !== 0;

  return (
    <View style={styles.hero}>
      <Pressable
        onPress={onPressMetrics}
        android_ripple={ripple}
        style={styles.summary}
        accessibilityRole="button"
        accessibilityLabel={`${isDeficit ? "Déficit" : "Disponible"} ${formatCurrency(Math.abs(metrics.remaining), currency)}, ${Math.round(usagePercentage)} % utilisé`}
      >
        <Eyebrow>
          {isDeficit ? "Déficit" : "Disponible"} ·{" "}
          {CURRENCY_METADATA[currency].symbol}
        </Eyebrow>

        <Amount size="hero">{signedAmount(metrics.remaining, currency)}</Amount>

        {hasRollover && (
          // The carry-over names a month, so the disclosure is also the way to go
          // read it — the same question iOS answers with a read-only sheet.
          <Pressable
            style={styles.rollover}
            onPress={onPressRollover}
            android_ripple={ripple}
            disabled={onPressRollover === undefined}
            accessibilityRole={
              onPressRollover === undefined ? undefined : "link"
            }
            accessibilityLabel={
              onPressRollover === undefined
                ? undefined
                : `Voir ${previousMonthName ?? "le mois précédent"}`
            }
          >
            <MaterialCommunityIcons
              name="autorenew"
              size={ICON_SIZE.xs}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {previousMonthName === null
                ? "Report du mois précédent inclus"
                : `Report ${ofMonth(previousMonthName)} inclus`}
            </Text>
            <Amount size="meta" tone="muted">
              {formatSignedCurrency(rollover, currency)}
            </Amount>
            {onPressRollover !== undefined && (
              <MaterialCommunityIcons
                name="chevron-right"
                size={ICON_SIZE.xs}
                color={theme.colors.onSurfaceVariant}
              />
            )}
          </Pressable>
        )}

        <View style={styles.progressRow}>
          <ProgressBar
            progress={usage / PERCENT}
            color={financial.savings}
            style={styles.progress}
          />
          <Amount size="meta" tone="savings">
            {Math.round(usagePercentage)}%
          </Amount>
        </View>
      </Pressable>

      {/* Outside the pressable, and running edge to edge: the three of them are
          a hair too wide for a phone, so they scroll — and a rail that owns a
          horizontal gesture must not also be a button. */}
      <FadingRail accessibilityLabel="Répartition du mois">
        <Pill
          icon="arrow-down"
          amount={formatAmount(metrics.totalIncome, currency)}
          label="revenus"
          tint={financial.income}
        />
        <Pill
          icon="piggy-bank-outline"
          amount={formatAmount(metrics.totalSavings, currency)}
          label="épargne"
          tint={financial.savings}
        />
        <Pill
          icon="arrow-up"
          amount={formatAmount(metrics.totalExpenses, currency)}
          label="dépenses"
          // The darker amber, not the row one: expense ink on its own tint
          // measures 3.85:1, and `overBudget` is the value already tuned to
          // clear AA on a surface of this family (4.59:1).
          tint={financial.overBudget}
        />
      </FadingRail>
    </View>
  );
}

/**
 * A `+` only where it adds meaning: a negative amount already reads as one.
 * Decimals, always — this is the screen where a line is being edited, and a
 * hero that rounds forty centimes to `+0` announces a sign with nothing after
 * it. The rule iOS keeps on the same screen.
 */
function signedAmount(value: number, currency: SupportedCurrency): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatAmount(Math.abs(value), currency)}`;
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.xs, paddingVertical: SPACING.sm },
  // The hero pays its own gutter so the pill rail underneath does not have to —
  // it reaches the screen edges, which is where its fades belong.
  summary: { gap: SPACING.xs, paddingHorizontal: SCREEN_PADDING },
  rollover: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  progress: { flex: 1, height: SPACING.sm, borderRadius: RADIUS.full },
});
