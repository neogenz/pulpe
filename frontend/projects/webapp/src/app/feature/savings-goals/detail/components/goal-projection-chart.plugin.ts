import type { Chart, Plugin } from 'chart.js';
import type { SavingsGoalPlanMonth } from 'pulpe-shared';
import {
  type ChartThemeColors,
  CHART_FONT_FAMILY,
  colorWithAlpha,
} from '@core/chart/chart-theme';

export function findCurrentPeriodIndex(
  months: readonly SavingsGoalPlanMonth[],
): number {
  return months.findIndex((month) => month.state === 'current');
}

function resolveGuidePosition(chart: Chart, currentIndex: number) {
  if (currentIndex < 0) return null;
  const xScale = chart.scales['x'];
  const { ctx, chartArea } = chart;
  if (!xScale || !chartArea) return null;

  const x = xScale.getPixelForValue(currentIndex);
  return Number.isFinite(x) ? { ctx, chartArea, x } : null;
}

export function buildGoalProjectionGuidePlugin(
  currentIndex: number,
  theme: ChartThemeColors,
  label: string,
): Plugin {
  const futureBackground = colorWithAlpha(theme.tickColor, 0.035);
  const markerColor = colorWithAlpha(theme.tickColor, 0.35);
  const labelBackground = colorWithAlpha(theme.tickColor, 0.1);

  return {
    id: 'goal-projection-guide',
    beforeDatasetsDraw(chart) {
      const guide = resolveGuidePosition(chart, currentIndex);
      if (!guide) return;
      const { ctx, chartArea, x } = guide;

      ctx.save();
      ctx.fillStyle = futureBackground;
      ctx.fillRect(
        x,
        chartArea.top,
        Math.max(0, chartArea.right - x),
        chartArea.height,
      );
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const guide = resolveGuidePosition(chart, currentIndex);
      if (!guide) return;
      const { ctx, chartArea, x } = guide;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1;
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    },
    afterDraw(chart) {
      if (!label) return;
      const guide = resolveGuidePosition(chart, currentIndex);
      if (!guide) return;
      const { ctx, chartArea, x } = guide;

      ctx.save();
      ctx.font = `600 11px ${CHART_FONT_FAMILY}`;
      const width = ctx.measureText(label).width + 14;
      const height = 20;
      const centerX = Math.min(
        chartArea.right - width / 2,
        Math.max(chartArea.left + width / 2, x),
      );
      const top = chartArea.top + 4;

      ctx.fillStyle = labelBackground;
      ctx.beginPath();
      ctx.roundRect(centerX - width / 2, top, width, height, 5);
      ctx.fill();
      ctx.fillStyle = theme.tickColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, centerX, top + height / 2);
      ctx.restore();
    },
  };
}
