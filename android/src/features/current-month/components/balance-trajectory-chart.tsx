import {
  Circle,
  DashPathEffect,
  Line as SkiaLine,
  vec,
} from "@shopify/react-native-skia";
import type { BalanceTrajectory, BudgetPeriodDates } from "pulpe-shared";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { CartesianChart, Line } from "victory-native";

import { formatDayMonth } from "@/core/ui/date-format";
import { SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  type CaptionWidths,
  chartSeries,
  chartYDomain,
  todayCaptionLeft,
} from "../balance-chart-scale";

const CHART_HEIGHT = 120;
const LINE_WIDTH = 3;
const RULE_WIDTH = 1;
const TODAY_MARKER_RADIUS = 6;
const PROJECTION_OPACITY = 0.5;
const RULE_DASH = 3;
const PROJECTION_DASH = 5;
const PROJECTION_GAP = 4;
const CAPTION_GAP = SPACING.sm;

interface BalanceTrajectoryChartProps {
  trajectory: BalanceTrajectory;
  /** The dates the captions print at either end of the plot. */
  period: BudgetPeriodDates;
  /** One ink for the line, the gap and the marker — the hero's own accent. */
  accent: string;
  ruleColor: string;
}

/**
 * The month's landing forecast: it opens on the plan, it arrives on the figure
 * above it, and it only leaves the horizontal when the month leaves its plan.
 *
 * Unlike the iOS twin the labels are not drawn inside the plot — printing text
 * on a Skia canvas means shipping and loading a font file. The scale is a row
 * of ordinary text under the canvas instead: the period's first and last day
 * at the edges, "today" under the marker.
 */
export function BalanceTrajectoryChart({
  trajectory,
  period,
  accent,
  ruleColor,
}: BalanceTrajectoryChartProps) {
  const { locale, t } = useTranslation();
  const data = chartSeries(trajectory);
  const domain = chartYDomain(trajectory);
  const [widths, setWidths] = useState<CaptionWidths>({
    row: 0,
    start: 0,
    today: 0,
    end: 0,
  });
  const measure = (key: keyof CaptionWidths) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setWidths((current) =>
      current[key] === width ? current : { ...current, [key]: width },
    );
  };
  const todayFraction =
    trajectory.totalDays > 0 ? trajectory.today / trajectory.totalDays : 0;
  const captionStyle = { color: ruleColor };

  return (
    <View style={styles.chart}>
      <View
        style={{ height: CHART_HEIGHT }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("home.hero.chartAccessibility")}
      >
        <CartesianChart
          data={data}
          xKey="day"
          yKeys={["landed", "projected"]}
          domain={{ x: [0, trajectory.totalDays], y: domain }}
          // No axes and no grid. The only reference this plot needs is the
          // plan, and that is the dashed rule below — a lattice of unlabelled
          // lines behind it would only compete with the one line that means
          // something.
          xAxis={{ lineWidth: 0 }}
          yAxis={[{ lineWidth: 0 }]}
        >
          {({ points, chartBounds, xScale, yScale }) => {
            const planY = yScale(trajectory.plannedBalance);
            return (
              <>
                <SkiaLine
                  p1={vec(chartBounds.left, planY)}
                  p2={vec(chartBounds.right, planY)}
                  color={ruleColor}
                  strokeWidth={RULE_WIDTH}
                >
                  <DashPathEffect intervals={[RULE_DASH, RULE_DASH]} />
                </SkiaLine>

                <Line
                  points={points.landed}
                  color={accent}
                  strokeWidth={LINE_WIDTH}
                  curveType="monotoneX"
                  connectMissingData={false}
                />

                <Line
                  points={points.projected}
                  color={accent}
                  strokeWidth={LINE_WIDTH}
                  opacity={PROJECTION_OPACITY}
                  connectMissingData={false}
                >
                  <DashPathEffect
                    intervals={[PROJECTION_DASH, PROJECTION_GAP]}
                  />
                </Line>

                <Circle
                  cx={xScale(trajectory.today)}
                  cy={yScale(trajectory.estimatedBalance)}
                  r={TODAY_MARKER_RADIUS}
                  color={accent}
                />
              </>
            );
          }}
        </CartesianChart>
      </View>

      <View style={styles.captions} onLayout={measure("row")}>
        <Text
          variant="labelSmall"
          style={captionStyle}
          onLayout={measure("start")}
        >
          {formatDayMonth(period.startDate, locale)}
        </Text>
        <Text
          testID="chart-caption-today"
          variant="labelSmall"
          onLayout={measure("today")}
          // Invisible until the row has been measured: the first frame would
          // otherwise paint it at the left edge and then jump it into place.
          style={[
            styles.today,
            {
              left: todayCaptionLeft(widths, todayFraction, CAPTION_GAP),
              color: widths.row === 0 ? "transparent" : ruleColor,
            },
          ]}
        >
          {t("home.hero.chart.today")}
        </Text>
        <Text
          variant="labelSmall"
          style={captionStyle}
          onLayout={measure("end")}
        >
          {formatDayMonth(period.endDate, locale)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: SPACING.xs },
  captions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  today: { position: "absolute", top: 0 },
});
