import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { TagStore } from '@core/tag';
import { UserSettingsStore } from '@core/user-settings';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { TagIndicator } from '@ui/tag-indicator';
import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import type { BudgetLineTableItem } from '../../view-models/table-items.view-model';
import { BudgetDetailsStore } from '../../store/budget-details-store';
import {
  BudgetDetailPanel,
  type BudgetDetailPanelData,
} from './budget-detail-panel';

const TAG_NAMES = new Map([
  ['tag-assurance', 'Assurance'],
  ['tag-bureau', 'Bureau'],
]);

async function setup(
  tagIds: string[],
): Promise<ComponentFixture<BudgetDetailPanel>> {
  const budgetLine = createMockBudgetLine({
    id: 'line-1',
    name: 'test',
    amount: 57.34,
  });
  const transaction = createMockTransaction({
    id: 'transaction-1',
    budgetLineId: budgetLine.id,
    name: 'test',
    amount: 234,
    tagIds,
  });
  const item: BudgetLineTableItem = {
    data: budgetLine,
    metadata: {
      itemType: 'budget_line',
      cumulativeBalance: 0,
      kindIcon: 'payments',
      allocationLabel: 'Ajouter une dépense',
      displayName: budgetLine.name,
    },
  };
  const data: BudgetDetailPanelData = {
    item,
    onAddTransaction: vi.fn(),
    onDeleteTransaction: vi.fn(),
    onToggleTransactionCheck: vi.fn(),
    onEditTransaction: vi.fn(),
  };

  await TestBed.configureTestingModule({
    imports: [BudgetDetailPanel],
    providers: [
      provideZonelessChangeDetection(),
      provideAnimationsAsync(),
      ...provideTranslocoForTest(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      {
        provide: UserSettingsStore,
        useValue: { currency: signal('CHF') },
      },
      {
        provide: TagStore,
        useValue: {
          resolveNames: vi.fn((ids: readonly string[] | undefined) =>
            (ids ?? [])
              .map((id) => TAG_NAMES.get(id))
              .filter((name): name is string => !!name),
          ),
        },
      },
      {
        provide: BudgetDetailsStore,
        useValue: {
          budgetDetails: signal({
            budgetLines: [],
            transactions: [transaction],
          }),
          savingsGoalNameById: signal(new Map()),
          spreadOccurrenceViewModels: signal([]),
          spreadTracker: signal(null),
          isViewingSpreadCurrentPeriod: signal(false),
          isSpreadOccurrencesLoading: signal(false),
          spreadOccurrencesError: signal(null),
          setSpreadGroupId: vi.fn(),
        },
      },
    ],
  })
    .overrideDirective(FinancialKindDirective, { set: { host: {} } })
    .overrideComponent(FinancialKindIndicator, { set: { template: '' } })
    .compileComponents();

  const fixture = TestBed.createComponent(BudgetDetailPanel);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('BudgetDetailPanel transaction tags', () => {
  it('should resolve allocated transaction tags for its compact indicator', async () => {
    const fixture = await setup(['tag-assurance', 'tag-bureau']);
    expect(TestBed.inject(TagStore).resolveNames).toHaveBeenCalledWith([
      'tag-assurance',
      'tag-bureau',
    ]);
    const transaction = fixture.componentInstance['allocatedTransactions']()[0];

    expect(transaction?.tagIds).toEqual(['tag-assurance', 'tag-bureau']);
    const resolvedTagNames = fixture.componentInstance['tagNamesFor'](
      transaction?.tagIds,
    );
    expect(resolvedTagNames).toEqual(['Assurance', 'Bureau']);

    const transactionRow = fixture.debugElement.query(
      By.css('[data-testid="detail-transaction-transaction-1"]'),
    );
    const indicator = transactionRow.query(By.directive(TagIndicator));
    expect(indicator).not.toBeNull();
    setTestInput(
      indicator.injector.get(TagIndicator).tagNames,
      resolvedTagNames,
    );
    fixture.detectChanges();

    const pill: HTMLSpanElement | null =
      indicator.nativeElement.querySelector('span[aria-label]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent ?? '').toContain('2');
    expect(pill?.getAttribute('aria-label') ?? '').toContain('Assurance');
    expect(pill?.getAttribute('aria-label') ?? '').toContain('Bureau');
  });

  it('should resolve an empty list when the transaction has no tags', async () => {
    const fixture = await setup([]);
    const transaction = fixture.componentInstance['allocatedTransactions']()[0];

    expect(TestBed.inject(TagStore).resolveNames).toHaveBeenCalledWith([]);
    expect(
      fixture.componentInstance['tagNamesFor'](transaction?.tagIds),
    ).toEqual([]);

    const transactionRow = fixture.debugElement.query(
      By.css('[data-testid="detail-transaction-transaction-1"]'),
    );
    const indicator = transactionRow.query(By.directive(TagIndicator));
    expect(indicator).not.toBeNull();
    expect(
      indicator.nativeElement.querySelector('span[aria-label]'),
    ).toBeNull();
    expect(indicator.nativeElement.querySelector('mat-icon')).toBeNull();
  });
});
