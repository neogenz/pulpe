import {
  Circle,
  DashPathEffect,
  Line as SkiaLine,
  vec,
} from "@shopify/react-native-skia";
import type { BalanceTrajectory } from "pulpe-shared";
import { View } from "react-native";
import { CartesianChart, Line } from "victory-native";

import { chartSeries, chartYDomain } from "../balance-chart-scale";
import { useTranslation } from "@/core/i18n/locale-store";

const CHART_HEIGHT = 120;
const LINE_WIDTH = 3;
const RULE_WIDTH = 1;
const TODAY_MARKER_RADIUS = 6;
const PROJECTION_OPACITY = 0.5;
const RULE_DASH = 3;
const PROJECTION_DASH = 5;
const PROJECTION_GAP = 4;

interface BalanceTrajectoryChartProps {
  trajectory: BalanceTrajectory;
  /** One ink for the line, the gap and the marker — the hero's own accent. */
  accent: string;
  ruleColor: string;
}

/**
 * The month's landing forecast: it opens on the plan, it arrives on the figure
 * above it, and it only leaves the horizontal when the month leaves its plan.
 *
 * Unlike the iOS twin the labels are not drawn inside the plot — printing text
 * on a Skia canvas means shipping and loading a font file for two captions the
 * card already prints beside it.
 */
export function BalanceTrajectoryChart({
  trajectory,
  accent,
  ruleColor,
}: BalanceTrajectoryChartProps) {
  const { t } = useTranslation();
  const data = chartSeries(trajectory);
  const domain = chartYDomain(trajectory);

  return (
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
        // No axes and no grid. The only reference this plot needs is the plan,
        // and that is the dashed rule below — a lattice of unlabelled lines
        // behind it would only compete with the one line that means something.
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
                <DashPathEffect intervals={[PROJECTION_DASH, PROJECTION_GAP]} />
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
  );
}
