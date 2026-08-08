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
    setTestInput(component.totalCount, 0);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should read the subtitle as progress against the month, not a bare backlog', () => {
    setTestInput(component.forecasts, mockForecasts);
    setTestInput(component.totalCount, 12);
    setTestInput(component.showPointerHint, false);
    fixture.detectChanges();

    const subtitle = fixture.debugElement.query(By.css('h2 + p'));
    expect(subtitle.nativeElement.textContent.trim()).toBe(
      `${12 - mockForecasts.length} sur 12 pointées`,
    );
  });

  // The gate used to be this month's check count, so the definition returned
  // every 1st of the month for the life of the account. It now keys on whether
  // the user has ever pointed, which the page owns and persists.
  it('should keep the count for a user who has already pointed, whatever the month', () => {
    setTestInput(component.forecasts, mockForecasts);
    setTestInput(component.totalCount, mockForecasts.length);
    setTestInput(component.showPointerHint, false);
    fixture.detectChanges();

    const subtitle = fixture.debugElement.query(By.css('h2 + p'));
    // Matches both forms — this fixture holds a single forecast, and the
    // count renders in the singular.
    expect(subtitle.nativeElement.textContent).toContain('pointée');
    expect(subtitle.nativeElement.textContent).not.toContain('Pointer :');
  });

  // No plural resolver is configured for transloco, so a count of one used to
  // render "1 autres prévisions ce mois" — and one is exactly the count this
  // line takes the first month a list of five overflows.
  it('should say "1 autre prévision" when the list hides a single forecast', () => {
    // Six outstanding forecasts against a cap of five — the first month a list
    // overflows, and the only count this line can take then.
    const sixForecasts = Array.from({ length: 6 }, (_, index) => ({
      ...mockForecasts[0],
      id: `forecast-${index}`,
    }));
    setTestInput(component.forecasts, sixForecasts);
    setTestInput(component.totalCount, sixForecasts.length);
    fixture.detectChanges();

    const hidden = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-forecasts-hidden-count"]',
    );
    expect(hidden?.textContent?.trim()).toBe('1 autre à pointer');
  });

  // "Pointer" is the verb this card runs on and the one house word the page
  // never defined — only the first-run tour did, months before anyone needs the
  // answer. At zero the count restates the list right below it, so that is the
  // slot the definition takes, until the first check proves it landed.
  it('should define the verb until the first forecast is checked', () => {
    setTestInput(component.forecasts, mockForecasts);
    setTestInput(component.totalCount, mockForecasts.length);
    fixture.detectChanges();

    const subtitle = fixture.debugElement.query(By.css('h2 + p'));
    expect(subtitle.nativeElement.textContent.trim()).toContain(
      'marquer une prévision comme réalisée',
    );
  });

  it('should not congratulate a month that had nothing to point', () => {
    fixture.detectChanges();

    const messageEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-empty-state"]'),
    );
    expect(messageEl).toBeTruthy();
    expect(messageEl.nativeElement.textContent).toContain(
      'Aucune prévision ce mois',
    );
    expect(messageEl.nativeElement.textContent).not.toContain(
      'Tout est à jour !',
    );
  });

  it('should display the reward once every forecast has been pointed', () => {
    setTestInput(component.totalCount, 3);
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
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
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
    );
    radioButton.nativeElement.click();

    // Simulate optimistic-removal then rollback (mutation error)
    setTestInput(component.forecasts, []);
    fixture.detectChanges();
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const icon = fixture.debugElement
      .query(By.css('[data-testid="dashboard-forecasts-toggle"]'))
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

  // The row prints what the envelope still expects, so a partly consumed line
  // was indistinguishable from an untouched one of the same size: a 1'500 rent
  // with 1'400 allocated read "Loyer 100", in the same weight and place as an
  // untouched 100. The largest commitment in the household could appear as the
  // smallest row on the card that asks what is still to come.
  it('should name the plan behind a partly consumed envelope', () => {
    setTestInput(component.forecasts, mockForecasts);

    const consumptionsMap = new Map<string, BudgetLineConsumption>([
      [
        '1',
        {
          budgetLine: mockForecasts[0],
          consumed: 90,
          remaining: 10,
          allocatedTransactions: [],
          transactionCount: 1,
        },
      ],
    ]);
    setTestInput(component.consumptions, consumptionsMap);
    fixture.detectChanges();

    const plannedEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-planned"]'),
    );
    expect(plannedEl).not.toBeNull();
    expect(plannedEl.nativeElement.textContent).toContain('100');

    // The toggle is named by the row's own elements, never by an attribute
    // carrying their values: an attribute is serialized whole into a session
    // replay, and these are exactly the strings ph-no-capture withholds.
    const toggle = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
    ).nativeElement as HTMLElement;
    expect(toggle.getAttribute('aria-label')).toBeNull();
    const labelledBy = toggle.getAttribute('aria-labelledby') ?? '';
    expect(labelledBy).toContain(plannedEl.nativeElement.id);
    for (const id of labelledBy.split(' ')) {
      expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('should not restate the plan on an untouched forecast', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="dashboard-forecasts-planned"]'),
      ),
    ).toBeNull();
  });

  // A month funded entirely from savings goals has nothing pointable, and the
  // subtitle fell through to the count: "0 sur 0 pointées", sitting above "Tout
  // est à jour", congratulating the user for work that never existed.
  it('should say nothing about progress when the month holds nothing pointable', () => {
    setTestInput(component.forecasts, []);
    setTestInput(component.totalCount, 0);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(
        By.css('[data-testid="dashboard-forecasts-subtitle"]'),
      ),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('0 sur 0');
  });

  // `consumption.remaining` is `amount - consumed` with nothing clamping it, so
  // an over-allocated envelope rendered "−50 CHF" in expense amber and had the
  // toggle announce "Pointer Courses — -50 CHF". A negative expense is not a
  // quantity a reader of this list expects; zero says the true thing.
  it('should floor an over-consumed envelope at zero rather than show a negative', () => {
    setTestInput(component.forecasts, mockForecasts);

    const consumptionsMap = new Map<string, BudgetLineConsumption>([
      [
        '1',
        {
          budgetLine: mockForecasts[0],
          consumed: 650,
          remaining: -50,
          allocatedTransactions: [],
          transactionCount: 2,
        },
      ],
    ]);
    setTestInput(component.consumptions, consumptionsMap);
    fixture.detectChanges();

    const amountEl = fixture.debugElement.query(
      By.css('[data-testid="dashboard-forecasts-amount"]'),
    );
    expect(amountEl.nativeElement.textContent).toContain('0');
    expect(amountEl.nativeElement.textContent).not.toContain('-50');
    expect(amountEl.nativeElement.textContent).not.toContain('−50');
  });

  it('should clamp ghost insertion when the forecast list shrinks below the ghost originalIndex', () => {
    const lines: BudgetLine[] = Array.from({ length: 5 }, (_, i) => ({
      ...mockForecasts[0],
      id: `line-${i}`,
      name: `Line ${i}`,
    }));
    setTestInput(component.forecasts, lines);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
    );
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
        By.css('[data-testid="dashboard-forecasts-toggle"]'),
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

    const buttons = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
    );
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

  it('should hand focus to the toggle that takes the checked row’s place', async () => {
    const lines = Array.from({ length: 3 }, (_, i) => ({
      ...mockForecasts[0],
      id: `line-${i}`,
      name: `Line ${i}`,
    }));
    setTestInput(component.forecasts, lines);
    fixture.detectChanges();

    fixture.debugElement
      .queryAll(By.css('[data-testid="dashboard-forecasts-toggle"]'))[1]
      .nativeElement.click();

    setTestInput(
      component.forecasts,
      lines.filter((line) => line.id !== 'line-1'),
    );
    fixture.detectChanges();

    (
      fixture.debugElement.query(By.css('.checking'))
        .nativeElement as HTMLElement
    ).dispatchEvent(
      Object.assign(new Event('animationend'), {
        animationName: 'forecast-check-exit',
      }),
    );
    await TestBed.tick();

    const remaining = fixture.debugElement.queryAll(
      By.css('[data-testid="dashboard-forecasts-toggle"]'),
    );
    expect(remaining.length).toBe(2);
    expect(document.activeElement).toBe(remaining[1].nativeElement);
  });

  it('should hand focus to the empty state once the last row is checked', async () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="dashboard-forecasts-toggle"]'))
      .nativeElement.click();

    setTestInput(component.forecasts, []);
    fixture.detectChanges();

    (
      fixture.debugElement.query(By.css('.checking'))
        .nativeElement as HTMLElement
    ).dispatchEvent(
      Object.assign(new Event('animationend'), {
        animationName: 'forecast-check-exit',
      }),
    );
    await TestBed.tick();

    expect(document.activeElement).toBe(
      fixture.debugElement.query(
        By.css('[data-testid="dashboard-forecasts-empty-state"]'),
      ).nativeElement,
    );
  });
});
