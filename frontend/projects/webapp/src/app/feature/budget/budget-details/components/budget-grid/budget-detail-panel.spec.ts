import {
  provideZonelessChangeDetection,
  signal,
  type WritableSignal,
} from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { type BudgetLine, type Transaction } from 'pulpe-shared';
import { TagStore } from '@core/tag';
import { UserSettingsStore } from '@core/user-settings';
import { FinancialKindDirective } from '@ui/financial-kind';
import { FinancialKindIndicator } from '@ui/financial-kind-indicator';
import { TagIndicator } from '@ui/tag-indicator';
import { SavingsGoalSourceLine } from '@ui/savings-goal-source/savings-goal-source-line';
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

let budgetDetailsSignal: WritableSignal<{
  budgetLines: BudgetLine[];
  transactions: Transaction[];
}>;

const TAG_NAMES = new Map([
  ['tag-assurance', 'Assurance'],
  ['tag-bureau', 'Bureau'],
]);

async function setup(
  tagIds: string[],
  budgetLineOverrides: Partial<BudgetLine> = {},
  metadataOverrides: Partial<BudgetLineTableItem['metadata']> = {},
): Promise<ComponentFixture<BudgetDetailPanel>> {
  const budgetLine = createMockBudgetLine({
    id: 'line-1',
    name: 'test',
    amount: 57.34,
    ...budgetLineOverrides,
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
      ...metadataOverrides,
    },
  };
  const data: BudgetDetailPanelData = {
    item,
    onAddTransaction: vi.fn(),
    onEditBudgetLine: vi.fn(),
    onDeleteBudgetLine: vi.fn(),
    onSpreadBudgetLine: vi.fn(),
    onResetBudgetLine: vi.fn(),
    onPostponeBudgetLine: vi.fn(),
    onToggleBudgetLineCheck: vi.fn(),
    onRealizeWithdrawal: vi.fn(),
    onDeleteTransaction: vi.fn(),
    onToggleTransactionCheck: vi.fn(),
    onEditTransaction: vi.fn(),
  };
  budgetDetailsSignal = signal({
    budgetLines: [],
    transactions: [transaction],
  });

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
          budgetDetails: budgetDetailsSignal,
          hasNextMonthBudget: signal(false),
          nextMonthLabel: signal('septembre 2026'),
          savingsWithdrawalOriginLabel: signal('juillet 2026'),
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

describe('BudgetDetailPanel forecast actions', () => {
  it('should expose edit and delete for the forecast itself', async () => {
    const fixture = await setup([]);
    const data = TestBed.inject(MAT_DIALOG_DATA) as BudgetDetailPanelData;

    const editButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="edit-line-1"]',
    );
    const deleteButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="delete-line-1"]',
    );
    const moreButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="detail-more-actions-line-1"]',
    );

    expect(editButton).not.toBeNull();
    expect(deleteButton).not.toBeNull();
    expect(moreButton).not.toBeNull();

    editButton.click();
    await fixture.whenStable();
    expect(data.onEditBudgetLine).toHaveBeenCalledWith(data.item);

    deleteButton.click();
    await fixture.whenStable();
    expect(data.onDeleteBudgetLine).toHaveBeenCalledWith('line-1');
  });

  it('should expose withdrawal realization with the forecast actions', async () => {
    const fixture = await setup(
      [],
      { kind: 'income', sourceSavingsGoalId: 'goal-1' },
      { sourceWithdrawalCtaKey: 'budgetLine.realizeWithdrawalBalance' },
    );
    const data = TestBed.inject(MAT_DIALOG_DATA) as BudgetDetailPanelData;
    const forecastToolbar: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="detail-forecast-toolbar"]',
    );
    const movementsHeader: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="detail-movements-header"]',
    );
    const realizationButton: HTMLButtonElement = forecastToolbar.querySelector(
      '[data-testid="detail-realize-withdrawal-line-1"]',
    )!;

    expect(realizationButton).not.toBeNull();
    expect(
      movementsHeader.querySelector('[data-testid^="detail-realize"]'),
    ).toBeNull();
    expect(
      forecastToolbar.querySelector('[data-testid^="detail-more-actions-"]'),
    ).toBeNull();
    expect(
      forecastToolbar.querySelector('[data-testid="delete-line-1"]'),
    ).not.toBeNull();
    realizationButton.click();
    await fixture.whenStable();
    expect(data.onRealizeWithdrawal).toHaveBeenCalledWith('line-1');
  });

  it('should expose the forecast pointing control separately from movements', async () => {
    const fixture = await setup([]);
    const data = TestBed.inject(MAT_DIALOG_DATA) as BudgetDetailPanelData;
    const toggle: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="detail-toggle-check-line-1"]',
    );

    expect(toggle).not.toBeNull();
    toggle.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(data.onToggleBudgetLineCheck).toHaveBeenCalledWith('line-1');
  });

  it('should refresh action metadata when the last allocated movement is removed', async () => {
    const fixture = await setup([], {
      kind: 'income',
      recurrence: 'one_off',
    });
    const data = TestBed.inject(MAT_DIALOG_DATA) as BudgetDetailPanelData;
    const allocatedTransaction = createMockTransaction({
      id: 'allocated-income',
      kind: 'income',
      budgetLineId: data.item.data.id,
      amount: 10,
    });
    budgetDetailsSignal.set({
      budgetLines: [data.item.data],
      transactions: [allocatedTransaction],
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="detail-more-actions-line-1"]',
      ),
    ).toBeNull();

    budgetDetailsSignal.set({
      budgetLines: [data.item.data],
      transactions: [],
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="detail-more-actions-line-1"]',
      ),
    ).not.toBeNull();
  });
});

describe('BudgetDetailPanel consumption summary', () => {
  async function renderConsumption(
    planned: number,
    consumed: number,
  ): Promise<string> {
    const fixture = await setup([], { amount: planned, kind: 'expense' });
    const data = TestBed.inject(MAT_DIALOG_DATA) as BudgetDetailPanelData;
    budgetDetailsSignal.set({
      budgetLines: [data.item.data],
      transactions: [
        createMockTransaction({
          id: 'consumption-transaction',
          budgetLineId: data.item.data.id,
          kind: 'expense',
          amount: consumed,
        }),
      ],
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  }

  it('should show a cent-level overage consistently', async () => {
    const text = await renderConsumption(58.5, 58.55);

    expect(text).toContain('58.55 CHF');
    expect(text).toContain('-0.05 CHF');
    expect(text).toContain('Dépassé de 0.05 CHF');
    expect(text).not.toContain('Dépassé de 0 CHF');
  });

  it('should keep exact equality at 100% without an overage', async () => {
    const text = await renderConsumption(58.5, 58.5);

    expect(text).toContain('100% utilisé');
    expect(text).not.toContain('Dépassé de');
  });
});

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

describe('BudgetDetailPanel forecast tags', () => {
  it('should show the forecast tag indicator in the detail header', async () => {
    const fixture = await setup([], {
      tagIds: ['tag-assurance', 'tag-bureau'],
    });
    const indicator = fixture.debugElement.query(
      By.css('[data-testid="detail-forecast-tags"]'),
    );
    const resolvedTagNames = fixture.componentInstance['tagNamesFor']([
      'tag-assurance',
      'tag-bureau',
    ]);

    expect(indicator).not.toBeNull();
    setTestInput(
      indicator.injector.get(TagIndicator).tagNames,
      resolvedTagNames,
    );
    fixture.detectChanges();

    const pill: HTMLSpanElement | null =
      indicator.nativeElement.querySelector('span[aria-label]');
    expect(pill?.textContent ?? '').toContain('2');
    expect(pill?.getAttribute('aria-label') ?? '').toContain('Assurance');
    expect(pill?.getAttribute('aria-label') ?? '').toContain('Bureau');
  });
});

// PUL-329 v2 — the panel is the surface that says where the money comes from.
// A deleted goal keeps its snapshot name, so the line survives it as history.
// The assertions stop at the shared line being rendered: signal inputs do not
// travel from a parent template in this test environment (hence `setTestInput`
// above), so the two visual states belong to `savings-goal-source-line.spec.ts`.
describe('BudgetDetailPanel announced withdrawal source', () => {
  const GOAL_NAME = "Fonds d'urgence";

  it('should show where an announced withdrawal takes its money from', async () => {
    const fixture = await setup([], {
      sourceSavingsGoalId: 'goal-1',
      sourceSavingsGoalName: GOAL_NAME,
    });

    const source = fixture.debugElement.query(
      By.directive(SavingsGoalSourceLine),
    );
    expect(source.nativeElement.getAttribute('data-testid')).toBe(
      'detail-panel-source-goal-line-1',
    );
  });

  it('should keep showing the source once its goal is deleted', async () => {
    const fixture = await setup([], {
      sourceSavingsGoalId: null,
      sourceSavingsGoalName: GOAL_NAME,
    });

    expect(
      fixture.debugElement.query(By.directive(SavingsGoalSourceLine)),
    ).not.toBeNull();
  });

  it('should render no source line for a forecast without a source', async () => {
    const fixture = await setup([]);

    expect(
      fixture.debugElement.query(By.directive(SavingsGoalSourceLine)),
    ).toBeNull();
  });
});
