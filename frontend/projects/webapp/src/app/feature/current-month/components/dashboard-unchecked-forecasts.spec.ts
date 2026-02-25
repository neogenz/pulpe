import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DashboardUncheckedForecasts } from './dashboard-unchecked-forecasts';
import type { BudgetLine } from 'pulpe-shared';
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

  it('should emit toggleCheck event when checkbox is clicked', () => {
    setTestInput(component.forecasts, mockForecasts);
    fixture.detectChanges();

    let emittedId: string | undefined;
    component.toggleCheck.subscribe((id) => (emittedId = id));

    // Simulating child event
    fixture.componentInstance.toggleCheck.emit(mockForecasts[0].id);
    expect(emittedId).toBe(mockForecasts[0].id);
  });
});
