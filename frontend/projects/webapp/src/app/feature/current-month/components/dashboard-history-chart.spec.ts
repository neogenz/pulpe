import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardHistoryChart } from './dashboard-history-chart';
import type { HistoryDataPoint } from '../services/dashboard-state';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { setTestInput } from '../../../testing/signal-test-utils';
import { provideTranslocoForTest } from '../../../testing/transloco-testing';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardHistoryChart', () => {
  let component: DashboardHistoryChart;
  let fixture: ComponentFixture<DashboardHistoryChart>;

  const mockHistoryData: HistoryDataPoint[] = [
    {
      id: 'b1',
      month: 1,
      year: 2025,
      income: 5000,
      expenses: 3000,
      savings: 500,
    },
    {
      id: 'b2',
      month: 2,
      year: 2025,
      income: 5200,
      expenses: 3100,
      savings: 300,
    },
  ];

  const mockHistoryDataNoSavings: HistoryDataPoint[] = [
    {
      id: 'b1',
      month: 1,
      year: 2025,
      income: 5000,
      expenses: 3000,
      savings: 0,
    },
    {
      id: 'b2',
      month: 2,
      year: 2025,
      income: 5200,
      expenses: 3100,
      savings: 0,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHistoryChart],
      providers: [
        provideCharts(withDefaultRegisterables()),
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHistoryChart);
    component = fixture.componentInstance;
    setTestInput(component.history, []);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display empty message when no data is provided', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Pas encore d'historique",
    );
  });

  it('should report hasData false when history is empty', () => {
    expect(component.hasData()).toBe(false);
  });

  it('should report hasData true when history has entries', () => {
    setTestInput(component.history, mockHistoryData);
    fixture.detectChanges();
    expect(component.hasData()).toBe(true);
  });

  it('should compute chart data properly based on inputs', () => {
    setTestInput(component.history, mockHistoryData);

    const chartData = component.chartData();
    expect(chartData.labels?.length).toBe(2);
    // 4 datasets: Revenus, Dépenses, Épargne (savings > 0), Revenu moyen
    expect(chartData.datasets.length).toBe(4);
    expect(chartData.datasets[0].label).toBe('Revenus');
    expect(chartData.datasets[0].data).toEqual([5000, 5200]);
    expect(chartData.datasets[1].label).toBe('Dépenses');

    expect(chartData.datasets[1].data).toEqual([3000, 3100]);
  });

  describe('savings dataset', () => {
    it('should include savings dataset when savings data exists', () => {
      setTestInput(component.history, mockHistoryData);

      const chartData = component.chartData();
      const savingsDataset = chartData.datasets.find(
        (d) => d.label === 'Épargne',
      );
      expect(savingsDataset).toBeTruthy();
      expect(savingsDataset!.data).toEqual([500, 300]);
    });

    it('should not include savings dataset when all savings are 0', () => {
      setTestInput(component.history, mockHistoryDataNoSavings);

      const chartData = component.chartData();
      const savingsDataset = chartData.datasets.find(
        (d) => d.label === 'Épargne',
      );
      expect(savingsDataset).toBeUndefined();
    });
  });

  describe('expense color', () => {
    it('should have an expense dataset with a background color', () => {
      setTestInput(component.history, mockHistoryData);

      const chartData = component.chartData();
      const expenseDataset = chartData.datasets.find(
        (d) => d.label === 'Dépenses',
      );
      expect(expenseDataset).toBeTruthy();
      // Color is resolved from CSS custom properties after render;
      // in unit tests (no render cycle), it is an empty initial value.
      expect(expenseDataset!.backgroundColor).toBeDefined();
    });
  });

  describe('average income line', () => {
    it('should include average income reference line', () => {
      setTestInput(component.history, mockHistoryData);

      const chartData = component.chartData();
      const avgDataset = chartData.datasets.find(
        (d) => d.label === 'Revenu moyen',
      );
      expect(avgDataset).toBeTruthy();
      expect(
        (avgDataset as unknown as Record<string, unknown>)['borderDash'],
      ).toEqual([6, 4]);
    });

    it('should compute correct average income', () => {
      setTestInput(component.history, mockHistoryData);

      const chartData = component.chartData();
      const avgDataset = chartData.datasets.find(
        (d) => d.label === 'Revenu moyen',
      );
      const expectedAvg = (5000 + 5200) / 2;
      expect(avgDataset!.data).toEqual([expectedAvg, expectedAvg]);
    });
  });
});
