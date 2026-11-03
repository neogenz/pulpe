import { getBudgetPeriodForDate, type SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import {
  formatCompactAmount,
  formatCompactCurrency,
} from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { hapticSelection } from "@/core/ui/haptics";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useBudgetList } from "@/features/budgets/budget-queries";

import {
  balanceForecasts,
  forecastOutlook,
  type MonthlyForecast,
} from "../balance-forecast";

const PLOT_HEIGHT = 132;
const BAR_WIDTH = 26;
const BAR_MIN_HEIGHT = 10;
const BASELINE_HEIGHT = 1;
const SELECTION_DOT = 6;
const MONTHS_PER_YEAR = 12;
/** Unselected bars step back through their ink (~70%), still 3:1 against the card, as on iOS. */
const UNSELECTED_ALPHA = "B3";

/**
 * The coming months' planned end balances as bars around zero, from `period`
 * on (the period in force when absent); a past month has none ahead. The
 * headline names where the balance turns; each bar carries its amount, and a
 * tap reads the month in full above the bars. Mirrors `ForecastSection` on iOS.
 */
export function ForecastSection({
  currency,
  period,
}: {
  currency: SupportedCurrency;
  period?: { month: number; year: number };
}) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const settings = useUserSettings();
  const budgets = useBudgetList();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const muted = { color: theme.colors.onSurfaceVariant };

  const current =
    settings.data === undefined
      ? undefined
      : getBudgetPeriodForDate(new Date(), settings.data.payDayOfMonth);
  const start = period ?? current;
  const isPast =
    start !== undefined &&
    current !== undefined &&
    start.year * MONTHS_PER_YEAR + start.month <
      current.year * MONTHS_PER_YEAR + current.month;
  const forecasts =
    start === undefined || budgets.data === undefined
      ? []
      : balanceForecasts(budgets.data, start);
  const outlook = forecastOutlook(forecasts);
  const selected = forecasts[selectedIndex] ?? forecasts[0];
  const lowest = forecasts.reduce<MonthlyForecast | undefined>(
    (min, forecast) =>
      min === undefined || forecast.balance < min.balance ? forecast : min,
    undefined,
  );
  const monthName = (forecast: MonthlyForecast) =>
    formatMonthName(forecast.month, forecast.year, locale);
  const shortMonthName = (forecast: MonthlyForecast) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(
      new Date(forecast.year, forecast.month - 1, 1),
    );
  const tint = (forecast: MonthlyForecast) =>
    forecast.balance < 0 ? financial.overBudget : financial.savings;

  if (isPast) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleLarge">{t("home.realized.forecast.title")}</Text>
      {forecasts.length < 2 ||
      outlook === null ||
      selected === undefined ||
      lowest === undefined ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="bodyMedium" style={muted}>
            {t("home.realized.forecast.empty")}
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium">
            {t(`home.realized.forecast.outlook.${outlook.kind}`, {
              month: monthName(outlook.forecast),
            })}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            {t("home.realized.forecast.tightest", {
              month: monthName(lowest),
              amount: formatCompactCurrency(lowest.balance, currency),
            })}
          </Text>

          <View style={styles.readout}>
            <Amount
              size="hero"
              tone={selected.balance < 0 ? "overBudget" : "savings"}
            >
              {formatCompactCurrency(selected.balance, currency)}
            </Amount>
            <Text variant="bodySmall" style={muted}>
              {selected === lowest
                ? `${t("home.realized.forecast.endOf", { month: monthName(selected) })} · ${t("home.realized.forecast.tightestTag")}`
                : t("home.realized.forecast.endOf", {
                    month: monthName(selected),
                  })}
            </Text>
          </View>

          <Bars
            forecasts={forecasts}
            selected={selected}
            onSelect={(index) => {
              hapticSelection();
              setSelectedIndex(index);
            }}
            label={(forecast) =>
              formatCompactAmount(forecast.balance, currency)
            }
            accessibilityLabel={(forecast) =>
              `${monthName(forecast)}, ${formatCompactCurrency(forecast.balance, currency)}`
            }
            shortMonthName={shortMonthName}
            tint={tint}
          />

          <Text variant="bodySmall" style={muted}>
            {t("home.realized.forecast.footnote")}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The columns touch so each one's zero line joins its neighbours'. The amount
 * rides the bar's tip; the empty side keeps an invisible one so every column
 * puts zero at the same height.
 */
function Bars({
  forecasts,
  selected,
  onSelect,
  label,
  accessibilityLabel,
  shortMonthName,
  tint,
}: {
  forecasts: MonthlyForecast[];
  selected: MonthlyForecast;
  onSelect: (index: number) => void;
  label: (forecast: MonthlyForecast) => string;
  accessibilityLabel: (forecast: MonthlyForecast) => string;
  shortMonthName: (forecast: MonthlyForecast) => string;
  tint: (forecast: MonthlyForecast) => string;
}) {
  const theme = useTheme();
  const ripple = useRipple();
  const balances = forecasts.map((forecast) => forecast.balance);
  const maxPositive = Math.max(...balances, 0);
  const maxNegative = Math.max(...balances.map((balance) => -balance), 0);
  const scale = PLOT_HEIGHT / Math.max(maxPositive + maxNegative, 1);
  const positiveRegion = balances.some((balance) => balance >= 0)
    ? Math.max(maxPositive * scale, BAR_MIN_HEIGHT)
    : 0;
  const negativeRegion = balances.some((balance) => balance < 0)
    ? Math.max(maxNegative * scale, BAR_MIN_HEIGHT)
    : 0;

  return (
    <View style={styles.bars}>
      {forecasts.map((forecast, index) => {
        const isSelected = forecast === selected;
        const isPositive = forecast.balance >= 0;
        const height = Math.max(
          Math.abs(forecast.balance) * scale,
          BAR_MIN_HEIGHT,
        );
        const ink = isSelected
          ? theme.colors.onSurface
          : theme.colors.onSurfaceVariant;
        // The empty side's label is a blank line: it only holds the height.
        const value = (isShown: boolean) => (
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={[TABULAR_DIGITS, { color: ink }, isSelected && styles.bold]}
          >
            {isShown ? label(forecast) : " "}
          </Text>
        );
        const bar = (barHeight: number) => (
          <View
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: isSelected
                  ? tint(forecast)
                  : `${tint(forecast)}${UNSELECTED_ALPHA}`,
              },
            ]}
          />
        );

        return (
          <Pressable
            key={`${forecast.year}-${forecast.month}`}
            onPress={() => onSelect(index)}
            android_ripple={ripple}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={accessibilityLabel(forecast)}
            style={styles.column}
          >
            {positiveRegion > 0 && (
              <View
                style={[
                  styles.side,
                  { paddingTop: positiveRegion - (isPositive ? height : 0) },
                ]}
              >
                {value(isPositive)}
                {bar(isPositive ? height : 0)}
              </View>
            )}
            <View
              style={[
                styles.baseline,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
            {negativeRegion > 0 && (
              <View
                style={[
                  styles.side,
                  { paddingBottom: negativeRegion - (isPositive ? 0 : height) },
                ]}
              >
                {bar(isPositive ? 0 : height)}
                {value(!isPositive)}
              </View>
            )}
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={[styles.month, { color: ink }, isSelected && styles.bold]}
            >
              {shortMonthName(forecast)}
            </Text>
            <View
              style={[
                styles.selectionDot,
                {
                  backgroundColor: isSelected
                    ? theme.colors.onSurface
                    : "transparent",
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm, marginTop: SPACING.sm },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.xs },
  readout: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  bars: { flexDirection: "row", marginTop: SPACING.md },
  column: { flex: 1, alignItems: "center" },
  side: { alignItems: "center", gap: SPACING.xxs },
  bar: { width: BAR_WIDTH, borderRadius: BAR_WIDTH / 2 },
  baseline: { alignSelf: "stretch", height: BASELINE_HEIGHT },
  month: { marginTop: SPACING.sm },
  selectionDot: {
    width: SELECTION_DOT,
    height: SELECTION_DOT,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  bold: { fontWeight: "700" },
});
