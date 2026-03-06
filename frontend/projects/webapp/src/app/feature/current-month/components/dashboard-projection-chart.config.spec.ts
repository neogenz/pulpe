import type { UpcomingMonthForecast } from '../services/dashboard-state';
import type { ChartThemeColors } from '../utils/chart-utils';
import { buildProjectionChartData } from './dashboard-projection-chart.config';

const mockTheme: ChartThemeColors = {
  income: '#4caf50',
  expense: '#f44336',
  savings: '#2196f3',
  negative: '#ff5722',
  tickColor: '#666',
  gridColor: '#eee',
  tooltipBg: '#333',
};

function makeForecast(
  overrides: Partial<UpcomingMonthForecast> & { month: number },
): UpcomingMonthForecast {
  return {
    year: 2026,
    hasBudget: true,
    income: null,
    expenses: null,
    savings: null,
    ...overrides,
  };
}

describe('buildProjectionChartData', () => {
  it('should return empty data when no forecasts have budgets', () => {
    const forecasts: UpcomingMonthForecast[] = [
      makeForecast({ month: 4, hasBudget: false }),
    ];

    const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
    expect(result.datasets).toEqual([]);
    expect(result.labels).toEqual([]);
  });

  it('should return empty data when theme is null', () => {
    const forecasts: UpcomingMonthForecast[] = [
      makeForecast({ month: 4, income: 5000, expenses: 3000, savings: 500 }),
    ];

    const result = buildProjectionChartData(forecasts, null, 'fr-CH');
    expect(result.datasets).toEqual([]);
  });

  describe('balance calculation (regression: savings must NOT be double-subtracted)', () => {
    it('should compute balance as income - expenses (savings already included in expenses)', () => {
      // After envelope logic: totalExpenses includes savings.
      // balance = income - totalExpenses (NOT income - expenses - savings)
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({
          month: 4,
          income: 5000,
          expenses: 4500, // includes 1500 savings
          savings: 1500,
        }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      const balanceDataset = result.datasets[0];

      // Correct: 5000 - 4500 = 500
      // Bug was: 5000 - 4500 - 1500 = -1000
      expect(balanceDataset.data).toEqual([500]);
    });

    it('should compute balance correctly when savings are zero', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({
          month: 4,
          income: 5000,
          expenses: 3000,
          savings: 0,
        }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.datasets[0].data).toEqual([2000]);
    });

    it('should compute balance correctly for multiple months', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({
          month: 4,
          income: 5000,
          expenses: 4500,
          savings: 1500,
        }),
        makeForecast({
          month: 5,
          income: 5200,
          expenses: 4000,
          savings: 1000,
        }),
        makeForecast({
          month: 6,
          income: 5000,
          expenses: 5000,
          savings: 2000,
        }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');

      // balance = income - expenses for each month
      expect(result.datasets[0].data).toEqual([500, 1200, 0]);
    });

    it('should handle negative balance (expenses exceed income)', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({
          month: 4,
          income: 3000,
          expenses: 4000,
          savings: 1000,
        }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.datasets[0].data).toEqual([-1000]);
    });
  });

  describe('cumulative savings dataset', () => {
    it('should include cumulative savings when savings exist', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({ month: 4, income: 5000, expenses: 4500, savings: 500 }),
        makeForecast({
          month: 5,
          income: 5000,
          expenses: 4300,
          savings: 300,
        }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      const savingsDataset = result.datasets.find(
        (d) => d.label === 'Épargne cumulée',
      );

      expect(savingsDataset).toBeTruthy();
      expect(savingsDataset!.data).toEqual([500, 800]);
    });

    it('should not include savings dataset when all savings are zero', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({ month: 4, income: 5000, expenses: 3000, savings: 0 }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.datasets.length).toBe(1);
      expect(result.datasets[0].label).toBe('Disponible');
    });
  });

  describe('labels', () => {
    it('should use short month names as labels', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({ month: 4, income: 100, expenses: 50, savings: 0 }),
        makeForecast({ month: 5, income: 100, expenses: 50, savings: 0 }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.labels?.length).toBe(2);
    });

    it('should skip months without budgets', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({ month: 4, income: 100, expenses: 50, savings: 0 }),
        makeForecast({ month: 5, hasBudget: false }),
        makeForecast({ month: 6, income: 100, expenses: 50, savings: 0 }),
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.labels?.length).toBe(2);
    });
  });

  describe('null values treated as zero', () => {
    it('should treat null income/expenses/savings as 0', () => {
      const forecasts: UpcomingMonthForecast[] = [
        makeForecast({ month: 4 }), // all nulls
      ];

      const result = buildProjectionChartData(forecasts, mockTheme, 'fr-CH');
      expect(result.datasets[0].data).toEqual([0]);
    });
  });
});
