import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { BudgetFormulas, SupportedCurrency } from "pulpe-shared";
import { CURRENCY_METADATA } from "pulpe-shared";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";

import {
  formatCompactAmount,
  formatCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import { FadingRail } from "@/core/ui/fading-rail";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SCREEN_PADDING,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import { budgetUsagePercentage } from "../budget-details-selectors";

const PERCENT = 100;
/** Amounts are shown to the centime, so that is the precision that counts. */
const CENTIMES_PER_UNIT = 100;
const PILL_ICON_SIZE = 14;
const ROLLOVER_ICON_SIZE = 13;
/** Tint strength of a pill's background against its own ink. */
const PILL_TINT = "1F";

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
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
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
        style={styles.summary}
        accessibilityRole="button"
        accessibilityLabel={`${isDeficit ? "Déficit" : "Disponible"} ${formatCurrency(Math.abs(metrics.remaining), currency)}, ${Math.round(usagePercentage)} % utilisé`}
      >
        <Text
          variant="labelLarge"
          style={[styles.eyebrow, { color: theme.colors.onSurfaceVariant }]}
        >
          {isDeficit ? "Déficit" : "Disponible"} ·{" "}
          {CURRENCY_METADATA[currency].symbol}
        </Text>

        <Text variant="displaySmall" style={TABULAR_DIGITS} numberOfLines={1}>
          {signedAmount(metrics.remaining, currency)}
        </Text>

        {hasRollover && (
          // The carry-over names a month, so the disclosure is also the way to go
          // read it — the same question iOS answers with a read-only sheet.
          <Pressable
            style={styles.rollover}
            onPress={onPressRollover}
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
              size={ROLLOVER_ICON_SIZE}
              color={theme.colors.outline}
            />
            <Text variant="labelMedium" style={{ color: theme.colors.outline }}>
              {previousMonthName === null
                ? "Report du mois précédent inclus"
                : `Report de ${previousMonthName} inclus`}
            </Text>
            <Text
              variant="labelMedium"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatSignedCompactCurrency(rollover, currency)}
            </Text>
            {onPressRollover !== undefined && (
              <MaterialCommunityIcons
                name="chevron-right"
                size={ROLLOVER_ICON_SIZE}
                color={theme.colors.outline}
              />
            )}
          </Pressable>
        )}

        <View style={styles.progressRow}>
          <ProgressBar
            progress={usage / PERCENT}
            color={FINANCIAL_COLORS[scheme].savings}
            style={styles.progress}
          />
          <Text
            variant="labelLarge"
            style={[
              TABULAR_DIGITS,
              { color: FINANCIAL_COLORS[scheme].savings },
            ]}
          >
            {Math.round(usagePercentage)}%
          </Text>
        </View>
      </Pressable>

      {/* Outside the pressable, and running edge to edge: the three of them are
          a hair too wide for a phone, so they scroll — and a rail that owns a
          horizontal gesture must not also be a button. */}
      <FadingRail accessibilityLabel="Répartition du mois">
        <Pill
          icon="arrow-down"
          amount={metrics.totalIncome}
          label="revenus"
          tint={FINANCIAL_COLORS[scheme].income}
          currency={currency}
        />
        <Pill
          icon="piggy-bank-outline"
          amount={metrics.totalSavings}
          label="épargne"
          tint={FINANCIAL_COLORS[scheme].savings}
          currency={currency}
        />
        <Pill
          icon="arrow-up"
          amount={metrics.totalExpenses}
          label="dépenses"
          tint={FINANCIAL_COLORS[scheme].expense}
          currency={currency}
        />
      </FadingRail>
    </View>
  );
}

function Pill({
  icon,
  amount,
  label,
  tint,
  currency,
}: {
  icon: "arrow-down" | "arrow-up" | "piggy-bank-outline";
  amount: number;
  label: string;
  tint: string;
  currency: SupportedCurrency;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: `${tint}${PILL_TINT}` }]}>
      <MaterialCommunityIcons name={icon} size={PILL_ICON_SIZE} color={tint} />
      <Text variant="labelLarge" style={[TABULAR_DIGITS, { color: tint }]}>
        {formatCompactAmount(amount, currency)}
      </Text>
      <Text variant="labelLarge" style={{ color: tint }}>
        {label}
      </Text>
    </View>
  );
}

/** A `+` only where it adds meaning: a negative amount already reads as one. */
function signedAmount(value: number, currency: SupportedCurrency): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCompactAmount(Math.abs(value), currency)}`;
}

const styles = StyleSheet.create({
  hero: { gap: SPACING.xs, paddingVertical: SPACING.sm },
  // The hero pays its own gutter so the pill rail underneath does not have to —
  // it reaches the screen edges, which is where its fades belong.
  summary: { gap: SPACING.xs, paddingHorizontal: SCREEN_PADDING },
  eyebrow: { textTransform: "uppercase", letterSpacing: 1 },
  rollover: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  progress: { flex: 1, height: SPACING.sm, borderRadius: RADIUS.full },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
});
