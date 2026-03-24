import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { StorageService } from '@core/storage';
import { BudgetItemsContainer } from './budget-items-container';
import { BudgetDetailsDialogService } from './budget-details-dialog.service';

registerLocaleData(localeDE);

/**
 * StorageService mock that returns 'table' for the desktop view mode,
 * preventing BudgetGrid and BudgetTable from rendering as child components
 * when budgetTableData() is empty. This avoids Angular issue #54039
 * (required input not set before template initialization in child components).
 */
const mockStorageService = {
  getString: () => 'table',
  setString: () => undefined,
  get: () => null,
  set: () => undefined,
  remove: () => undefined,
};

describe('BudgetItemsContainer — contextual empty states', () => {
  let component: BudgetItemsContainer;
  let fixture: ComponentFixture<BudgetItemsContainer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetItemsContainer, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: StorageService, useValue: mockStorageService },
        {
          provide: BudgetDetailsDialogService,
          useValue: { openEditBudgetLineDialog: async () => null },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetItemsContainer);
    component = fixture.componentInstance;

    setTestInput(component.budgetLines, []);
    setTestInput(component.transactions, []);
    setTestInput(component.checkedCount, 0);
    setTestInput(component.totalCount, 0);
    setTestInput(component.totalBudgetLinesCount, 0);
    setTestInput(component.isShowingOnlyUnchecked, false);
    setTestInput(component.searchText, '');
    setTestInput(component.estimatedBalance, 0);
  });

  it('shows contextual empty state when filter active and all items are checked', () => {
    setTestInput(component.isShowingOnlyUnchecked, true);
    setTestInput(component.totalCount, 3);
    setTestInput(component.totalBudgetLinesCount, 3);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).toContain('Tout est pointé');
    expect(nativeEl.querySelector('[data-testid="add-first-line"]')).toBeNull();
  });

  it('does not show contextual filter empty state when budget has no envelopes', () => {
    // Use search state to avoid rendering child components (Angular #54039)
    setTestInput(component.searchText, 'xyz');
    setTestInput(component.isShowingOnlyUnchecked, true);
    setTestInput(component.totalCount, 0);
    setTestInput(component.totalBudgetLinesCount, 0);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });

  it('counter uses totalBudgetLinesCount not filtered count', () => {
    // Use search state to avoid rendering child components (Angular #54039)
    setTestInput(component.searchText, 'xyz');
    setTestInput(component.totalBudgetLinesCount, 5);
    setTestInput(component.totalCount, 2);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).toContain('5 prévisions ce mois');
  });

  it('does not show contextual filter empty state when only transactions exist (no budget lines)', () => {
    // Use search state to avoid rendering child components (Angular #54039)
    setTestInput(component.searchText, 'xyz');
    setTestInput(component.isShowingOnlyUnchecked, true);
    setTestInput(component.totalCount, 3);
    setTestInput(component.totalBudgetLinesCount, 0);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });

  it('search empty state takes priority over filter empty state', () => {
    setTestInput(component.searchText, 'xyz');
    setTestInput(component.isShowingOnlyUnchecked, true);
    setTestInput(component.totalCount, 3);
    setTestInput(component.totalBudgetLinesCount, 3);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    const hasSearchOffIcon = Array.from(
      nativeEl.querySelectorAll('mat-icon'),
    ).some((el) => el.textContent?.trim() === 'search_off');
    expect(hasSearchOffIcon).toBe(true);
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });
});
