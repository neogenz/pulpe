import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { DashboardUncheckedForecasts } from './dashboard-unchecked-forecasts';
import type { BudgetLine } from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget/budget-line-consumption';
import { FinancialKindDirective } from '@ui/financial-kind';
import { setTestInput } from '../../../testing/signal-test-utils';
import { StubFinancialKindDirective } from '../../../testing/stub-directives';
import { provideTranslocoForTest } from '../../../testing/transloco-testing';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';

registerLocaleData(localeDE);

describe('DashboardUncheckedForecasts', () => {
  let component: DashboardUncheckedForecasts;
  let fixture: ComponentFixture<DashboardUncheckedForecasts>;

  const mockForecasts: BudgetLine[] = [
    {
      id: '1',
      budgetId: 'b1',
      templateLineId: null,
      savingsGoalId: null,
      name: 'Test Forecast',
      amount: 100,
      kind: 'expense',
      recurrence: 'fixed',
      isManuallyAdjusted: false,
      checkedAt: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardUncheckedForecasts],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    })
      .overrideComponent(DashboardUncheckedForecasts, {
        remove: { imports: [FinancialKindDirective] },
        add: { imports: [StubFinancialKindDirective] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardUncheckedForecasts);
    component = fixture.componentInstance;
    setTestInput(component.forecasts, []);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should display the empty state message when there are no forecasts', () => {
    fixture.detectChanges();

    const messageEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-empty-state"]'),
    );
    expect(messageEl).toBeTruthy();
    expect(messageEl.nativeElement.textContent).toContain('Tout est à jour !');
  });

  it('should display the list of forecasts when provided', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    // Check subtitle count
    const subtitle = fixture.debugElement.query(
      By.css('.text-body-small.text-on-surface-variant'),
    );
    expect(subtitle.nativeElement.textContent).toContain('(1)');

    // Check list item
    const itemNames = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-name"]'),
    );
    expect(itemNames.length).toBeGreaterThan(0);
    expect(itemNames[0].nativeElement.textContent).toContain('Test Forecast');
  });

  it('should emit toggleCheck only when the radio button is clicked', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    let emittedId: string | undefined;
    component.toggleCheck.subscribe((id) => (emittedId = id));

    // Click the radio button
    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    radioButton.nativeElement.click();

    expect(emittedId).toBe('1');
  });

  it('should not emit toggleCheck when the row text is clicked', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    let emitted = false;
    component.toggleCheck.subscribe(() => (emitted = true));

    const nameSpan = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-name"]'),
    );
    nameSpan.nativeElement.click();

    expect(emitted).toBe(false);
  });

  it('should show radio_button_unchecked icon by default', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    const icon = radioButton.query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe(
      'radio_button_unchecked',
    );
  });

  it('should show check_circle filled icon while a forecast row is exiting after a click', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    radioButton.nativeElement.click();
    fixture.detectChanges();

    const icon = radioButton.query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('check_circle');
    expect(icon.nativeElement.classList.contains('text-primary')).toBe(true);
    expect(icon.nativeElement.classList.contains('icon-filled')).toBe(true);
  });

  it('should keep the row visible as a ghost after click until the exit animation ends', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    // Click the radio — emit fires; in real flow the parent removes the
    // forecast from the input. Simulate that here.
    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    radioButton.nativeElement.click();

    setTestInput(component.forecasts, []);
    fixture.detectChanges();

    let rows = fixture.debugElement.queryAll(By.css('.checking'));
    expect(rows.length).toBe(1);

    // Browser fires animationend after the keyframe completes. Simulate it.
    const row = rows[0].nativeElement as HTMLElement;
    row.dispatchEvent(
      Object.assign(new Event('animationend'), {
        animationName: 'forecast-check-exit',
      }),
    );
    fixture.detectChanges();

    rows = fixture.debugElement.queryAll(By.css('.checking'));
    expect(rows.length).toBe(0);
  });

  it('should ignore animationend events from unrelated animations', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    radioButton.nativeElement.click();

    setTestInput(component.forecasts, []);
    fixture.detectChanges();

    const row = fixture.debugElement.query(By.css('.checking'))
      .nativeElement as HTMLElement;
    row.dispatchEvent(
      Object.assign(new Event('animationend'), {
        animationName: 'some-other-animation',
      }),
    );
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.checking')).length).toBe(1);
  });

  it('should reset the checking state if the forecast reappears (rollback)', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    radioButton.nativeElement.click();

    // Simulate optimistic-removal then rollback (mutation error)
    setTestInput(component.forecasts, []);
    fixture.detectChanges();
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const icon = fixture.debugElement
      .query(By.css('button[aria-label]'))
      .query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe(
      'radio_button_unchecked',
    );
    expect(icon.nativeElement.classList.contains('text-primary')).toBe(false);
  });

  it('should display forecast amount with aggregation digitsInfo (no decimals)', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const amountEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-amount"]'),
    );
    expect(amountEl.nativeElement.textContent).toContain('100');
    expect(amountEl.nativeElement.textContent).toContain('CHF');
    expect(amountEl.nativeElement.textContent).not.toMatch(/[.,]00\b/);
  });

  it('should display remaining from consumptions map with no decimals', () => {
    setTestInput(component.forecasts, mockForecasts);

    const consumptionsMap = new Map<string, BudgetLineConsumption>([
      [
        '1',
        {
          budgetLine: mockForecasts[0],
          consumed: 30,
          remaining: 70,
          allocatedTransactions: [],
          transactionCount: 1,
        },
      ],
    ]);
    setTestInput(component.consumptions, consumptionsMap);
    fixture.detectChanges();

    const amountEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-amount"]'),
    );
    expect(amountEl.nativeElement.textContent).toContain('70');
    expect(amountEl.nativeElement.textContent).toContain('CHF');
    expect(amountEl.nativeElement.textContent).not.toMatch(/[.,]00\b/);
  });

  it('should clamp ghost insertion when the forecast list shrinks below the ghost originalIndex', () => {
    const lines: BudgetLine[] = Array.from({ length: 5 }, (_, i) => ({
      ...mockForecasts[0],
      id: `line-${i}`,
      name: `Line ${i}`,
    }));
    setTestInput(component.forecasts, lines);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[aria-label]'));
    buttons[4].nativeElement.click();

    setTestInput(component.forecasts, [lines[0]]);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-row"]'),
    );
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('should clear stuck ghosts via the safety timer when animationend never fires', async () => {
    vi.useFakeTimers();
    try {
      setTestInput(component.forecasts, mockForecasts);
      fixture.detectChanges();

      const radioButton = fixture.debugElement.query(
        By.css('button[aria-label]'),
      );
      radioButton.nativeElement.click();

      setTestInput(component.forecasts, []);
      fixture.detectChanges();

      let rows = fixture.debugElement.queryAll(By.css('.checking'));
      expect(rows.length).toBe(1);

      // Advance past animation duration + buffer (500ms + 100ms) without
      // dispatching `animationend` — simulates iOS Safari skipping the event.
      await vi.advanceTimersByTimeAsync(650);
      fixture.detectChanges();

      rows = fixture.debugElement.queryAll(By.css('.checking'));
      expect(rows.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should preserve insertion order when multiple ghosts animate concurrently', () => {
    const lines: BudgetLine[] = Array.from({ length: 3 }, (_, i) => ({
      ...mockForecasts[0],
      id: `line-${i}`,
      name: `Line ${i}`,
    }));
    setTestInput(component.forecasts, lines);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button[aria-label]'));
    buttons[0].nativeElement.click();
    buttons[1].nativeElement.click();
    buttons[2].nativeElement.click();

    setTestInput(component.forecasts, []);
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-row"]'),
    );
    expect(rows.length).toBe(3);
    const names = rows.map((r) => r.nativeElement.textContent ?? '');
    expect(names[0]).toContain('Line 0');
    expect(names[1]).toContain('Line 1');
    expect(names[2]).toContain('Line 2');
  });
});
