import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardHistoryChart } from './dashboard-history-chart';
import type { HistoryDataPoint } from '../services/dashboard-store';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { setTestInput } from '../../../testing/signal-test-utils';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardHistoryChart', () => {
  let component: DashboardHistoryChart;
  let fixture: ComponentFixture<DashboardHistoryChart>;

  const mockHistoryData: HistoryDataPoint[] = [
    { month: 1, year: 2025, income: 5000, expenses: 3000 },
    { month: 2, year: 2025, income: 5200, expenses: 3100 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHistoryChart],
      providers: [
        provideCharts(withDefaultRegisterables()),
        provideZonelessChangeDetection(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHistoryChart);
    component = fixture.componentInstance;
    setTestInput(component.history, []);
  });

  it('should create', () => {
    setTestInput(component.history, []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display empty message when no data is provided', () => {
    setTestInput(component.history, []);
    fixture.detectChanges();

    // May not exactly match selector, checking for empty view
    expect(fixture.nativeElement.textContent).toContain('Pas assez de données');
  });

  it('should display chart canvas when data is provided', () => {
    setTestInput(component.history, mockHistoryData);
    fixture.detectChanges();

    const canvas = fixture.debugElement.query(By.css('canvas'));
    expect(canvas).toBeTruthy();
  });

  it('should compute chart data properly based on inputs', () => {
    setTestInput(component.history, mockHistoryData);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels?.length).toBe(2);
    expect(chartData.datasets.length).toBe(2);
    // Datasets mapped to labels Revnus/Dépenses
    expect(chartData.datasets[0].label).toBe('Revenus');
    expect(chartData.datasets[0].data).toEqual([5000, 5200]);
    expect(chartData.datasets[1].data).toEqual([3000, 3100]);
  });
});
