import type { Plugin } from 'chart.js';
import type { SavingsGoalPlanMonth } from 'pulpe-shared';
import { type ChartThemeColors, colorWithAlpha } from '@core/chart/chart-theme';

export function findCurrentPeriodIndex(
  months: readonly SavingsGoalPlanMonth[],
): number {
  return months.findIndex((month) => month.state === 'current');
}

export function buildGoalProjectionGuidePlugin(
  currentIndex: number,
  theme: ChartThemeColors,
): Plugin {
  const futureBackground = colorWithAlpha(theme.tickColor, 0.035);
  const markerColor = colorWithAlpha(theme.tickColor, 0.35);

  return {
    id: 'goal-projection-guide',
    beforeDatasetsDraw(chart) {
      if (currentIndex < 0) return;
      const xScale = chart.scales['x'];
      const { ctx, chartArea } = chart;
      if (!xScale || !chartArea) return;

      const x = xScale.getPixelForValue(currentIndex);
      if (!Number.isFinite(x)) return;

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
      if (currentIndex < 0) return;
      const xScale = chart.scales['x'];
      const { ctx, chartArea } = chart;
      if (!xScale || !chartArea) return;

      const x = xScale.getPixelForValue(currentIndex);
      if (!Number.isFinite(x)) return;

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
  };
}
