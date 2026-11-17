import {
  Circle,
  DashPathEffect,
  Line as SkiaLine,
  vec,
} from "@shopify/react-native-skia";
import type { BudgetPeriodDates } from "pulpe-shared";
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Text } from "react-native-paper";
import { CartesianChart, Line } from "victory-native";

import { formatDayMonth } from "@/core/ui/date-format";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import { scrubDayAt, scrubFigure, type ScrubReading } from "../balance-scrub";
import {
  type CaptionWidths,
  chartPlan,
  chartProjection,
  chartYDomain,
  todayCaptionLeft,
} from "../balance-chart-scale";
import type { TrendedTrajectory } from "../current-month-view-model";

const CHART_HEIGHT = 120;
const LINE_WIDTH = 3;
const RULE_WIDTH = 1;
const DOT_RADIUS = 6;
const DOT_HALO_RADIUS = 8;
const RULE_DASH = 3;
const PROJECTION_DASH = 5;
const PROJECTION_GAP = 4;
const CAPTION_GAP = SPACING.sm;
// A bare drag would take the page's vertical scroll with it; a short hold first keeps the two apart.
const SCRUB_HOLD_MS = 150;

interface BalanceTrajectoryChartProps {
  trajectory: TrendedTrajectory;
  /** The dates the captions print at either end of the plot. */
  period: BudgetPeriodDates;
  /** The ink of the projection: the hero's own accent. */
  accent: string;
  /** What the finger reads while scrubbing, null at rest. */
  reading: ScrubReading | null;
  /** What a screen reader says about the whole trajectory. */
  accessibilityLabel: string;
  onScrub?: (day: number | null) => void;
}

/**
 * The month as a burn-down of what it has: the plan falls in a straight dashed
 * line from the opening amount to what it meant to keep, the real stroke falls
 * by every outflow pointed so far, and from today a dashed stroke in the accent
 * carries it to where the month lands if it keeps its pace. Port of
 * `balanceChart` in `HomeHeroCard+Chart.swift`.
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
  reading,
  accessibilityLabel,
  onScrub,
}: BalanceTrajectoryChartProps) {
  const hero = useHeroColors();
  const { locale, t } = useTranslation();
  const data = trajectory.real.map(({ day, balance }) => ({
    day,
    real: balance,
  }));
  const plan = chartPlan(trajectory);
  const projection = chartProjection(trajectory);
  const domain = chartYDomain(trajectory);
  const lastReal = trajectory.real[trajectory.real.length - 1];
  // The dot sits on the stroke the finger reads, else on today's reading.
  const dot =
    reading === null
      ? lastReal
      : { day: reading.day, balance: scrubFigure(reading) };
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
  const [plotWidth, setPlotWidth] = useState(0);
  const scrub = Gesture.Pan()
    .activateAfterLongPress(SCRUB_HOLD_MS)
    .runOnJS(true)
    .onUpdate((event) =>
      onScrub?.(scrubDayAt(event.x, plotWidth, trajectory.totalDays)),
    )
    .onFinalize(() => onScrub?.(null));
  const captionStyle = { color: hero.muted };

  return (
    <View style={styles.chart}>
      <GestureDetector gesture={scrub}>
        <View
          style={{ height: CHART_HEIGHT }}
          onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
        >
          <CartesianChart
            data={data}
            xKey="day"
            yKeys={["real"]}
            domain={{ x: [0, trajectory.totalDays], y: domain }}
            // No axes and no grid. The plan is the only reference this plot
            // needs, and it is drawn below: a lattice of unlabelled lines
            // behind it would only compete with the one line that means
            // something.
            xAxis={{ lineWidth: 0 }}
            yAxis={[{ lineWidth: 0 }]}
          >
            {({ points, chartBounds, xScale, yScale }) => {
              const [planStart, planEnd] = plan;
              const [from, to] = projection;
              return (
                <>
                  {planStart !== undefined && planEnd !== undefined && (
                    <SkiaLine
                      p1={vec(xScale(planStart.day), yScale(planStart.balance))}
                      p2={vec(xScale(planEnd.day), yScale(planEnd.balance))}
                      color={hero.muted}
                      strokeWidth={RULE_WIDTH}
                    >
                      <DashPathEffect intervals={[RULE_DASH, RULE_DASH]} />
                    </SkiaLine>
                  )}

                  <Line
                    points={points.real}
                    color={hero.ink}
                    strokeWidth={LINE_WIDTH}
                    curveType="monotoneX"
                  />

                  {from !== undefined && to !== undefined && (
                    <SkiaLine
                      p1={vec(xScale(from.day), yScale(from.balance))}
                      p2={vec(xScale(to.day), yScale(to.balance))}
                      color={accent}
                      strokeWidth={LINE_WIDTH}
                    >
                      <DashPathEffect
                        intervals={[PROJECTION_DASH, PROJECTION_GAP]}
                      />
                    </SkiaLine>
                  )}

                  {reading !== null && (
                    <SkiaLine
                      p1={vec(xScale(reading.day), chartBounds.top)}
                      p2={vec(xScale(reading.day), chartBounds.bottom)}
                      color={hero.muted}
                      strokeWidth={RULE_WIDTH}
                    />
                  )}

                  {dot !== undefined && (
                    <>
                      <Circle
                        cx={xScale(dot.day)}
                        cy={yScale(dot.balance)}
                        r={DOT_HALO_RADIUS}
                        color={hero.surface}
                      />
                      <Circle
                        cx={xScale(dot.day)}
                        cy={yScale(dot.balance)}
                        r={DOT_RADIUS}
                        color={hero.ink}
                      />
                    </>
                  )}
                </>
              );
            }}
          </CartesianChart>
        </View>
      </GestureDetector>

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
              color: widths.row === 0 ? "transparent" : hero.ink,
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
  today: { position: "absolute", top: 0, fontWeight: "600" },
});
