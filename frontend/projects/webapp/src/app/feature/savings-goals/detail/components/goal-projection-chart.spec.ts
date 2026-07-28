import {
  Directive,
  Input,
  LOCALE_ID,
  provideZonelessChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeDeCh from '@angular/common/locales/de-CH';
import { TestBed } from '@angular/core/testing';
import { AmountsVisibilityService } from '@core/amounts-visibility/amounts-visibility.service';
import { BaseChartDirective } from 'ng2-charts';
import type {
  SavingsGoalPlanMonth,
  SavingsPlanSimulationResult,
} from 'pulpe-shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { GoalProjectionChart } from './goal-projection-chart';

registerLocaleData(localeDeCh, 'de-CH');

// Mirrors ng2-charts' third-party selector so the component template stays unchanged.
// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({ selector: 'canvas[baseChart]' })
class StubBaseChartDirective {
  @Input() data: unknown;
  @Input() options: unknown;
  @Input() plugins: unknown;
  @Input() type: unknown;
}

const months: SavingsGoalPlanMonth[] = [
  {
    month: 1,
    year: 2026,
    state: 'past',
    isLocked: true,
    plannedAmount: 100,
    confirmedAmount: 100,
    plannedCumulative: 100,
    confirmedCumulative: 100,
    lines: [],
  },
  {
    month: 2,
    year: 2026,
    state: 'current',
    isLocked: false,
    plannedAmount: 100,
    confirmedAmount: 20,
    plannedCumulative: 200,
    confirmedCumulative: 180,
    lines: [],
  },
  {
    month: 3,
    year: 2026,
    state: 'future',
    isLocked: false,
    plannedAmount: 180,
    confirmedAmount: 0,
    plannedCumulative: 380,
    confirmedCumulative: 180,
    lines: [],
  },
];

const draft: SavingsPlanSimulationResult = {
  months: months.map((month, index) => ({
    ...month,
    simulatedAmount: [100, 100, 240][index],
    simulatedCumulative: [100, 180, 420][index],
    isAdjusted: index === 2,
  })),
  simulatedFinal: 420,
  gapToTarget: -120,
  isTargetMet: true,
  attainedPeriod: { month: 3, year: 2026 },
};

describe('GoalProjectionChart', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoalProjectionChart],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
      ],
    })
      .overrideComponent(GoalProjectionChart, {
        remove: { imports: [BaseChartDirective] },
        add: { imports: [StubBaseChartDirective] },
      })
      .compileComponents();
  });

  afterEach(() => {
    document.body.classList.remove('amounts-hidden');
  });

  function render(simulation: SavingsPlanSimulationResult | null = null) {
    const fixture = TestBed.createComponent(GoalProjectionChart);
    const component = fixture.componentInstance;
    setTestInput(component.months, months);
    setTestInput(component.draft, simulation);
    setTestInput(component.targetAmount, 300);
    setTestInput(component.currency, 'CHF');
    setTestInput(component.confirmed, 180);
    setTestInput(component.projected, 360);
    fixture.detectChanges();
    return fixture;
  }

  it('renders target, confirmed savings and deadline projection as a semantic summary', () => {
    const fixture = render();
    const summary = fixture.nativeElement.querySelector(
      '[data-testid="goal-projection-summary"]',
    );
    const rows = summary?.querySelectorAll('div');

    expect(summary?.tagName).toBe('DL');
    expect(rows).toHaveLength(3);
    expect(summary?.textContent).toContain('Cible');
    expect(summary?.textContent).toContain('Épargné');
    expect(summary?.textContent).toContain("Projection à l'échéance");
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-projection-target-legend"]',
      )?.classList,
    ).toContain('bg-on-surface-variant');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-projection-summary-projection"]',
      )?.textContent,
    ).toContain('360');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-projection-aria"]',
      )?.textContent,
    ).toMatch(
      /cible 300(?:\.00)? CHF.+épargné 180(?:\.00)? CHF.+projection à l'échéance 360(?:\.00)? CHF/i,
    );
  });

  it('uses the simulated endpoint in the summary', () => {
    const fixture = render(draft);

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="goal-projection-summary-projection"]',
      )?.textContent,
    ).toContain('420');
  });

  it('hides visual and accessible amounts together', () => {
    const fixture = render();
    TestBed.inject(AmountsVisibilityService).toggle();
    fixture.detectChanges();

    const values = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid^="goal-projection-summary-"]',
      ),
    ].map((element: Element) => element.textContent?.trim());
    const aria = fixture.nativeElement.querySelector(
      '[data-testid="goal-projection-aria"]',
    )?.textContent;

    expect(values).toEqual(['•••••', '•••••', '•••••']);
    expect(aria).toContain('montants sont masqués');
    expect(aria).not.toMatch(/180|300|360|CHF/);
  });
});
