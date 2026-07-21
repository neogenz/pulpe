import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import type { TagHistoryMonth } from 'pulpe-shared';
import { describe, expect, it } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import {
  buildTagHistoryChartData,
  buildTagHistoryChartOptions,
  TagHistoryChart,
} from './tag-history-chart';

const periods: TagHistoryMonth[] = [
  { month: 5, year: 2026, plannedAmount: 100, actualAmount: 80 },
  { month: 6, year: 2026, plannedAmount: 0, actualAmount: 0 },
  { month: 7, year: 2026, plannedAmount: 150, actualAmount: 120 },
];

describe('TagHistoryChart', () => {
  it('keeps every period and renders exactly planned and actual series', () => {
    const data = buildTagHistoryChartData(periods, null, 'fr-CH', {
      planned: 'Prévu',
      actual: 'Réel',
    });

    expect(data.labels).toHaveLength(3);
    expect(data.datasets).toHaveLength(2);
    expect(data.datasets[0].data).toEqual([100, 0, 150]);
    expect(data.datasets[1].data).toEqual([80, 0, 120]);
  });

  it('masks tooltips and axes and disables animation when requested', () => {
    const options = buildTagHistoryChartOptions(null, true, 'CHF', true);
    const label = options?.plugins?.tooltip?.callbacks?.label;
    const tick = options?.scales?.['y']?.ticks?.callback;

    expect(options?.animation).toBe(false);
    expect(
      label?.call(
        {} as never,
        {
          dataset: { label: 'Réel' },
          parsed: { y: 120 },
        } as never,
      ),
    ).toBe('Réel: •••••');
    expect(tick?.call({} as never, 120, 0, [])).toBe('•');
  });

  it('removes monetary values from the accessible sentence when hidden', () => {
    TestBed.configureTestingModule({
      imports: [TagHistoryChart],
      providers: [
        provideZonelessChangeDetection(),
        provideCharts(withDefaultRegisterables()),
        ...provideTranslocoForTest(),
      ],
    });
    const fixture = TestBed.createComponent(TagHistoryChart);
    const component = fixture.componentInstance;
    setTestInput(component.periods, periods);
    setTestInput(component.selectedTagName, 'Courses');
    setTestInput(component.currency, 'CHF');
    setTestInput(component.totalActual, 200);
    setTestInput(component.monthlyAverageActual, 66.67);
    TestBed.inject(AmountsVisibilityService).toggle();

    expect(component.ariaSentence()).toContain('Courses');
    expect(component.ariaSentence()).toContain('montants sont masqués');
    expect(component.ariaSentence()).not.toContain('200');
    expect(component.ariaSentence()).not.toContain('CHF');
  });
});
