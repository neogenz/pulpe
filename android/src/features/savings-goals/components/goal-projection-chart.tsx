import {
  DashPathEffect,
  Line as SkiaLine,
  vec,
} from "@shopify/react-native-skia";
import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { Area, CartesianChart, Line } from "victory-native";

import { Amount } from "@/core/ui/amount";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatMonthYearShort } from "@/core/ui/date-format";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";

import { projectionYDomain, type ProjectionSeries } from "../projection-series";

const CHART_HEIGHT = 180;
const LINE_WIDTH = 3;
const RULE_WIDTH = 1;
const RULE_DASH = 4;
const PROJECTION_DASH = 5;
const PROJECTION_GAP = 4;
const AREA_OPACITY = 0.18;

interface GoalProjectionChartProps {
  series: ProjectionSeries;
  currency: SupportedCurrency;
}

/**
 * "Ta trajectoire": what has actually been put aside, where the plan lands, and
 * the target as a flat rule across both.
 *
 * Like the balance trajectory on the dashboard, the labels live beside the plot
 * rather than inside it — printing text on a Skia canvas means shipping a font
 * file for three captions the card can print itself.
 */
export function GoalProjectionChart({
  series,
  currency,
}: GoalProjectionChartProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();
  const savings = financial.savings;
  const income = financial.income;

  if (series.points.length === 0) return null;

  const domain = projectionYDomain(series);
  const lastIndex = series.points.length - 1;

  return (
    <View style={styles.chart}>
      <View style={{ height: CHART_HEIGHT }}>
        <CartesianChart
          data={series.points}
          xKey="index"
          yKeys={["confirmed", "projection"]}
          domain={{ x: [0, Math.max(lastIndex, 1)], y: domain }}
          xAxis={{ lineWidth: 0 }}
          yAxis={[{ lineWidth: 0 }]}
        >
          {({ points, chartBounds, yScale }) => (
            <>
              {series.target !== null && (
                <SkiaLine
                  p1={vec(chartBounds.left, yScale(series.target))}
                  p2={vec(chartBounds.right, yScale(series.target))}
                  color={theme.colors.outline}
                  strokeWidth={RULE_WIDTH}
                >
                  <DashPathEffect intervals={[RULE_DASH, RULE_DASH]} />
                </SkiaLine>
              )}

              <Area
                points={points.confirmed}
                y0={chartBounds.bottom}
                color={savings}
                opacity={AREA_OPACITY}
                curveType="monotoneX"
                connectMissingData={false}
              />

              <Line
                points={points.confirmed}
                color={savings}
                strokeWidth={LINE_WIDTH}
                curveType="monotoneX"
                connectMissingData={false}
              />

              <Line
                points={points.projection}
                color={income}
                strokeWidth={LINE_WIDTH}
                curveType="monotoneX"
                connectMissingData={false}
              >
                <DashPathEffect intervals={[PROJECTION_DASH, PROJECTION_GAP]} />
              </Line>
            </>
          )}
        </CartesianChart>
      </View>

      <View style={styles.ticks}>
        {series.ticks.map((tick) => (
          <Text
            key={tick.index}
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatMonthYearShort(tick.month, tick.year, locale)}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendEntry color={savings} label={t("goals.progress.saved")} />
        <LegendEntry color={income} label={t("goals.progress.projection")} />
        {series.target !== null && (
          <LegendEntry
            color={theme.colors.outline}
            label={t("goals.progress.target", {
              amount: formatCompactCurrency(series.target, currency),
            })}
          />
        )}
      </View>
    </View>
  );
}

function LegendEntry({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendEntry}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Amount size="meta" tone="muted">
        {label}
      </Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: SPACING.sm },
  ticks: { flexDirection: "row", justifyContent: "space-between" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  legendEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  swatch: { width: SPACING.sm, height: SPACING.xs, borderRadius: SPACING.xxs },
});
