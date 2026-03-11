import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardUncheckedForecasts } from './dashboard-unchecked-forecasts';
import type { BudgetLine } from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget/budget-line-consumption';
import { FinancialKindDirective } from '@ui/financial-kind';
import { setTestInput } from '../../../testing/signal-test-utils';
import { StubFinancialKindDirective } from '../../../testing/stub-directives';
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
      providers: [provideZonelessChangeDetection()],
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

    const messageEl = fixture.debugElement.query(By.css('.p-8.text-center'));
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
      By.css('.text-body-medium.font-bold'),
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
      By.css('.text-body-medium.font-bold'),
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

  it('should show check_circle icon with primary color when item is in checkingIds', () => {
    setTestInput(component.forecasts, mockForecasts);
    setTestInput(component.checkingIds, new Set(['1']));
    fixture.detectChanges();

    const radioButton = fixture.debugElement.query(
      By.css('button[aria-label]'),
    );
    const icon = radioButton.query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('check_circle');
    expect(icon.nativeElement.classList.contains('text-primary')).toBe(true);
  });

  it('should display forecast amount when no consumptions provided', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    const amountEl = fixture.debugElement.query(
      By.css('.text-label-large.tabular-nums'),
    );
    expect(amountEl.nativeElement.textContent).toContain('100');
    expect(amountEl.nativeElement.textContent).toContain('CHF');
  });

  it('should display remaining from consumptions map when provided', () => {
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
      By.css('.text-label-large.tabular-nums'),
    );
    expect(amountEl.nativeElement.textContent).toContain('70');
    expect(amountEl.nativeElement.textContent).toContain('CHF');
  });
});
