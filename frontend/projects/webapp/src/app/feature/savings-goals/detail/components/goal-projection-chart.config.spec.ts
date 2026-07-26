import { describe, it, expect } from 'vitest';
import type {
  SavingsGoalPlanMonth,
  SavingsPlanSimulatedMonth,
  SavingsPlanSimulationResult,
} from 'pulpe-shared';
import type { ChartThemeColors } from '@core/chart/chart-theme';
import { buildGoalProjectionChartData } from './goal-projection-chart.config';

const theme: ChartThemeColors = {
  income: 'rgb(76, 175, 80)',
  expense: 'rgb(244, 67, 54)',
  savings: 'rgb(33, 150, 243)',
  negative: 'rgb(255, 87, 34)',
  tickColor: 'rgb(102, 102, 102)',
  gridColor: 'rgba(102, 102, 102, 0.08)',
  tooltipBg: 'rgba(0, 0, 0, 0.9)',
};

const labels = {
  target: 'Cible',
  planned: 'Prévu cumulé',
  confirmed: 'Pointé',
  projection: 'Projection',
};

function makeMonth(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 1,
    year: 2026,
    state: 'past',
    isLocked: true,
    plannedAmount: 100,
    confirmedAmount: 100,
    plannedCumulative: 100,
    confirmedCumulative: 100,
    lines: [],
    ...overrides,
  };
}

const months: SavingsGoalPlanMonth[] = [
  makeMonth({
    month: 1,
    state: 'past',
    plannedCumulative: 100,
    confirmedCumulative: 100,
  }),
  makeMonth({
    month: 2,
    state: 'current',
    isLocked: false,
    plannedCumulative: 200,
    confirmedCumulative: 180,
  }),
  makeMonth({
    month: 3,
    state: 'future',
    isLocked: false,
    plannedCumulative: 300,
    confirmedCumulative: 180,
  }),
];

describe('buildGoalProjectionChartData', () => {
  it('returns empty datasets when there are no months', () => {
    const data = buildGoalProjectionChartData({
      months: [],
      draft: null,
      targetAmount: 300,
      confirmedPace: 90,
      theme,
      locale: 'fr-CH',
      labels,
    });
    expect(data.datasets).toHaveLength(0);
  });

  it('builds four series in read mode (cible, prévu, pointé, projection)', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmedPace: 90,
      theme,
      locale: 'fr-CH',
      labels,
    });
    expect(data.datasets.map((d) => d.label)).toEqual([
      'Cible',
      'Prévu cumulé',
      'Pointé',
      'Projection',
    ]);
  });

  it('keeps the savings series and omits only the target without a target amount', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: null,
      confirmedPace: 90,
      theme,
      locale: 'fr-CH',
      labels,
    });

    expect(data.datasets.map((dataset) => dataset.label)).toEqual([
      'Prévu cumulé',
      'Pointé',
      'Projection',
    ]);
  });

  it('nulls the pointé series after the current month', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmedPace: 90,
      theme,
      locale: 'fr-CH',
      labels,
    });
    const confirmed = data.datasets.find((d) => d.label === 'Pointé');
    // Index 2 is the future month → reality must stop (null), not extend.
    expect(confirmed?.data).toEqual([100, 180, null]);
  });

  it('drops the projection series and follows the sandbox in simulation mode', () => {
    const draft: SavingsPlanSimulationResult = {
      months: months.map(
        (month, index): SavingsPlanSimulatedMonth => ({
          ...month,
          simulatedAmount: month.plannedAmount,
          simulatedCumulative: [100, 260, 420][index],
          isAdjusted: index === 2,
        }),
      ),
      simulatedFinal: 420,
      gapToTarget: -120,
      isTargetMet: true,
      attainedPeriod: { month: 3, year: 2026 },
    };
    const data = buildGoalProjectionChartData({
      months,
      draft,
      targetAmount: 300,
      confirmedPace: 90,
      theme,
      locale: 'fr-CH',
      labels,
    });
    const dsLabels = data.datasets.map((d) => d.label);
    expect(dsLabels).not.toContain('Projection');
    const planned = data.datasets.find((d) => d.label === 'Prévu cumulé');
    expect(planned?.data).toEqual([100, 260, 420]);
  });

  it('omits the projection series when the confirmed pace is zero', () => {
    const data = buildGoalProjectionChartData({
      months,
      draft: null,
      targetAmount: 300,
      confirmedPace: 0,
      theme,
      locale: 'fr-CH',
      labels,
    });
    expect(data.datasets.map((d) => d.label)).not.toContain('Projection');
  });
});
