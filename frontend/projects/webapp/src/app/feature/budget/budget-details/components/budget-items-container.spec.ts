import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import {
  createMockTagStore,
  type MockTagStore,
} from '@app/testing/tag-store.mock';
import { createMockLogger } from '@app/testing/mock-posthog';
import { StorageService } from '@core/storage';
import { TagStore } from '@core/tag';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { BudgetApi } from '@core/budget/budget-api';
import { firstValueFrom } from 'rxjs';
import {
  transactionUpdateSchema,
  type BudgetLine,
  type Transaction,
  type TransactionUpdate,
} from 'pulpe-shared';
import { BudgetItemsContainer } from './budget-items-container';
import { BudgetTagFilter } from './budget-table/budget-tag-filter';
import { BudgetDetailsDialogService } from '../budget-details-dialog.service';
import { BudgetDetailsStore } from '../store/budget-details-store';

registerLocaleData(localeDE);

const mockStorageService = {
  getString: () => 'table',
  setString: () => undefined,
  get: () => null,
  set: () => undefined,
  remove: () => undefined,
};

const privacyTestTag = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Médicaments Lisa',
};

interface MockStore {
  budgetDetails: ReturnType<typeof signal<unknown>>;
  filteredBudgetLines: ReturnType<typeof signal<BudgetLine[]>>;
  filteredTransactions: ReturnType<typeof signal<Transaction[]>>;
  isShowingOnlyUnchecked: ReturnType<typeof signal<boolean>>;
  searchText: ReturnType<typeof signal<string>>;
  checkedItemsCount: ReturnType<typeof signal<number>>;
  totalItemsCount: ReturnType<typeof signal<number>>;
  totalBudgetLinesCount: ReturnType<typeof signal<number>>;
  realizedBalance: ReturnType<typeof signal<number>>;
  previousMonthRollover: ReturnType<typeof signal<number>>;
  hasNextMonthBudget: ReturnType<typeof signal<boolean>>;
  nextMonthLabel: ReturnType<typeof signal<string>>;
  savingsWithdrawalOriginLabel: ReturnType<typeof signal<string>>;
  savingsWithdrawalDeficit: ReturnType<typeof signal<number>>;
  savingsGoalNameById: ReturnType<typeof signal<ReadonlyMap<string, string>>>;
  setSearchText: ReturnType<typeof vi.fn>;
  setIsShowingOnlyUnchecked: ReturnType<typeof vi.fn>;
  createBudgetLine: ReturnType<typeof vi.fn>;
  createBudgetLineSpread: ReturnType<typeof vi.fn>;
  updateBudgetLine: ReturnType<typeof vi.fn>;
  deleteBudgetLine: ReturnType<typeof vi.fn>;
  deleteTransaction: ReturnType<typeof vi.fn>;
  resetBudgetLineFromTemplate: ReturnType<typeof vi.fn>;
  spreadExistingBudgetLine: ReturnType<typeof vi.fn>;
  postponeBudgetLine: ReturnType<typeof vi.fn>;
  postponeTransaction: ReturnType<typeof vi.fn>;
  toggleCheck: ReturnType<typeof vi.fn>;
  toggleTransactionCheck: ReturnType<typeof vi.fn>;
  checkAllAllocatedTransactions: ReturnType<typeof vi.fn>;
  createAllocatedTransaction: ReturnType<typeof vi.fn>;
  updateTransaction: ReturnType<typeof vi.fn>;
  createSavingsWithdrawal: ReturnType<typeof vi.fn>;
  deleteSavingsWithdrawal: ReturnType<typeof vi.fn>;
}

function createMockStore(): MockStore {
  return {
    budgetDetails: signal<unknown>(null),
    filteredBudgetLines: signal<BudgetLine[]>([]),
    filteredTransactions: signal<Transaction[]>([]),
    isShowingOnlyUnchecked: signal(false),
    searchText: signal(''),
    checkedItemsCount: signal(0),
    totalItemsCount: signal(0),
    totalBudgetLinesCount: signal(0),
    realizedBalance: signal(0),
    previousMonthRollover: signal(0),
    hasNextMonthBudget: signal(false),
    nextMonthLabel: signal(''),
    savingsWithdrawalOriginLabel: signal(''),
    savingsWithdrawalDeficit: signal(0),
    savingsGoalNameById: signal<ReadonlyMap<string, string>>(new Map()),
    setSearchText: vi.fn(),
    setIsShowingOnlyUnchecked: vi.fn(),
    createBudgetLine: vi.fn(),
    createBudgetLineSpread: vi.fn(),
    updateBudgetLine: vi.fn(),
    deleteBudgetLine: vi.fn(),
    deleteTransaction: vi.fn(),
    resetBudgetLineFromTemplate: vi.fn(),
    spreadExistingBudgetLine: vi.fn().mockResolvedValue({}),
    // A mutation now answers with its refusal motive, so `null` is its success.
    postponeBudgetLine: vi.fn().mockResolvedValue(null),
    postponeTransaction: vi.fn().mockResolvedValue(null),
    // The 3 check mutations answer with a 3-way outcome; `applied` is their default success.
    toggleCheck: vi.fn().mockResolvedValue({ status: 'applied' }),
    toggleTransactionCheck: vi.fn().mockResolvedValue({ status: 'applied' }),
    checkAllAllocatedTransactions: vi
      .fn()
      .mockResolvedValue({ status: 'applied' }),
    createAllocatedTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    createSavingsWithdrawal: vi.fn(),
    deleteSavingsWithdrawal: vi.fn(),
  };
}

interface MockDialogService {
  openTagHistory: ReturnType<typeof vi.fn>;
  openAddBudgetLineDialog: ReturnType<typeof vi.fn>;
  openEditBudgetLineDialog: ReturnType<typeof vi.fn>;
  openAllocatedTransactionsDialog: ReturnType<typeof vi.fn>;
  openCreateAllocatedTransactionDialog: ReturnType<typeof vi.fn>;
  openEditAllocatedTransactionDialog: ReturnType<typeof vi.fn>;
  openSpreadExisting: ReturnType<typeof vi.fn>;
  runSpreadProcessing: ReturnType<typeof vi.fn>;
  confirmDelete: ReturnType<typeof vi.fn>;
  confirmCheckAllocatedTransactions: ReturnType<typeof vi.fn>;
  confirmPostpone: ReturnType<typeof vi.fn>;
}

function createMockDialogService(): MockDialogService {
  return {
    openTagHistory: vi.fn(),
    openAddBudgetLineDialog: vi.fn().mockResolvedValue(undefined),
    openEditBudgetLineDialog: vi.fn().mockResolvedValue(undefined),
    openAllocatedTransactionsDialog: vi.fn().mockResolvedValue(undefined),
    openCreateAllocatedTransactionDialog: vi.fn().mockResolvedValue(undefined),
    openEditAllocatedTransactionDialog: vi.fn().mockResolvedValue(undefined),
    openSpreadExisting: vi.fn().mockResolvedValue(undefined),
    // Pass-through: keeps the wrapped store spread mutation exercised in tests.
    runSpreadProcessing: vi.fn((run: () => Promise<unknown>) => run()),
    confirmDelete: vi.fn().mockResolvedValue(false),
    confirmCheckAllocatedTransactions: vi.fn().mockResolvedValue(false),
    confirmPostpone: vi.fn().mockResolvedValue(false),
  };
}

function setupComponent(
  mockStore: MockStore,
  mockDialogService: MockDialogService,
  mockSnackBar: { open: ReturnType<typeof vi.fn> },
  mockTagStore: MockTagStore = createMockTagStore(),
): ComponentFixture<BudgetItemsContainer> {
  TestBed.configureTestingModule({
    imports: [BudgetItemsContainer, NoopAnimationsModule],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: StorageService, useValue: mockStorageService },
      { provide: BudgetDetailsDialogService, useValue: mockDialogService },
      { provide: BudgetDetailsStore, useValue: mockStore },
      { provide: MatSnackBar, useValue: mockSnackBar },
      {
        provide: UserSettingsStore,
        useValue: {
          currency: signal('CHF'),
          payDayOfMonth: signal(1),
        },
      },
      { provide: Logger, useValue: { warn: vi.fn(), error: vi.fn() } },
      { provide: TagStore, useValue: mockTagStore },
    ],
  });

  return TestBed.createComponent(BudgetItemsContainer);
}

describe('BudgetItemsContainer — contextual empty states', () => {
  let mockStore: MockStore;
  let fixture: ComponentFixture<BudgetItemsContainer>;

  beforeEach(() => {
    mockStore = createMockStore();
    fixture = setupComponent(mockStore, createMockDialogService(), {
      open: vi.fn(),
    });
  });

  it('shows contextual empty state when filter active and all items are checked', () => {
    mockStore.isShowingOnlyUnchecked.set(true);
    mockStore.totalItemsCount.set(3);
    mockStore.totalBudgetLinesCount.set(3);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).toContain('Tout est pointé');
    expect(nativeEl.querySelector('[data-testid="add-first-line"]')).toBeNull();
  });

  it('does not show contextual filter empty state when budget has no envelopes', () => {
    mockStore.searchText.set('xyz');
    mockStore.isShowingOnlyUnchecked.set(true);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });

  it('counter uses totalBudgetLinesCount not filtered count', () => {
    mockStore.searchText.set('xyz');
    mockStore.totalBudgetLinesCount.set(5);
    mockStore.totalItemsCount.set(2);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).toContain('5 prévisions ce mois');
  });

  it('does not show contextual filter empty state when only transactions exist (no budget lines)', () => {
    mockStore.searchText.set('xyz');
    mockStore.isShowingOnlyUnchecked.set(true);
    mockStore.totalItemsCount.set(3);
    mockStore.totalBudgetLinesCount.set(0);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });

  it('search empty state takes priority over filter empty state', () => {
    mockStore.searchText.set('xyz');
    mockStore.isShowingOnlyUnchecked.set(true);
    mockStore.totalItemsCount.set(3);
    mockStore.totalBudgetLinesCount.set(3);

    fixture.detectChanges();

    const nativeEl: HTMLElement = fixture.nativeElement;
    const hasSearchOffIcon = Array.from(
      nativeEl.querySelectorAll('mat-icon'),
    ).some((el) => el.textContent?.trim() === 'search_off');
    expect(hasSearchOffIcon).toBe(true);
    expect(nativeEl.textContent).not.toContain('Tout est pointé');
  });
});

describe('BudgetItemsContainer — tag filter', () => {
  it('masks user-provided tag names from session replay', () => {
    TestBed.configureTestingModule({
      imports: [BudgetTagFilter],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    });
    const fixture = TestBed.createComponent(BudgetTagFilter);
    const inputNode = fixture.componentInstance.tags[SIGNAL];
    inputNode.applyValueToInputSignal(inputNode, [privacyTestTag]);

    fixture.detectChanges();

    const tagName: HTMLElement | null = fixture.nativeElement.querySelector(
      `[data-testid="tag-filter-${privacyTestTag.id}"] .ph-no-capture`,
    );
    expect(tagName?.textContent).toContain(privacyTestTag.name);
  });

  it('keeps an envelope when its allocated transaction carries the selected tag', () => {
    const customTagId = '44444444-4444-4444-8444-444444444444';
    const budgetLine = createMockBudgetLine({
      id: 'rent-line',
      tagIds: [],
    });
    const allocatedTransaction = createMockTransaction({
      id: 'rent-payment',
      budgetLineId: budgetLine.id,
      tagIds: [customTagId],
    });
    const mockStore = createMockStore();
    mockStore.budgetDetails.set({
      id: 'budget-1',
      budgetLines: [budgetLine],
      transactions: [allocatedTransaction],
    });
    mockStore.filteredBudgetLines.set([budgetLine]);
    mockStore.filteredTransactions.set([allocatedTransaction]);
    const fixture = setupComponent(mockStore, createMockDialogService(), {
      open: vi.fn(),
    });

    fixture.componentInstance.selectedTagIds.set([customTagId]);

    expect(
      fixture.componentInstance.budgetLineItems().map((item) => item.data.id),
    ).toEqual([budgetLine.id]);
  });
});

describe('BudgetItemsContainer — orchestration', () => {
  let mockStore: MockStore;
  let mockDialogService: MockDialogService;
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<BudgetItemsContainer>;
  let component: BudgetItemsContainer;

  beforeEach(() => {
    mockStore = createMockStore();
    mockDialogService = createMockDialogService();
    mockSnackBar = { open: vi.fn() };
    fixture = setupComponent(mockStore, mockDialogService, mockSnackBar);
    component = fixture.componentInstance;
  });

  it('exposes openAddBudgetLineDialog as a public method for FAB integration', () => {
    expect(typeof component.openAddBudgetLineDialog).toBe('function');
  });

  it('does nothing when openAddBudgetLineDialog runs without a loaded budget', async () => {
    mockStore.budgetDetails.set(null);

    await component.openAddBudgetLineDialog();

    expect(mockDialogService.openAddBudgetLineDialog).not.toHaveBeenCalled();
    expect(mockStore.createBudgetLine).not.toHaveBeenCalled();
  });

  it('creates a budget line when add dialog returns a single value', async () => {
    mockStore.budgetDetails.set({ id: 'budget-1', month: 1, year: 2026 });
    const newLine = { name: 'Loyer', amount: 100 };
    mockDialogService.openAddBudgetLineDialog.mockResolvedValue({
      mode: 'single',
      value: newLine,
    });

    await component.openAddBudgetLineDialog();

    expect(mockDialogService.openAddBudgetLineDialog).toHaveBeenCalledWith({
      id: 'budget-1',
      month: 1,
      year: 2026,
    });
    expect(mockStore.createBudgetLine).toHaveBeenCalledWith(newLine);
  });

  it('fans out a spread when add dialog returns a spread value', async () => {
    mockStore.budgetDetails.set({ id: 'budget-1', month: 1, year: 2026 });
    const spread = {
      name: 'Prime',
      kind: 'expense' as const,
      perMonthAmount: 100,
      months: [
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ],
    };
    mockDialogService.openAddBudgetLineDialog.mockResolvedValue({
      mode: 'spread',
      value: spread,
    });
    mockStore.createBudgetLineSpread.mockResolvedValue({
      data: { lines: [], createdBudgets: [], skippedMonths: [] },
    });

    await component.openAddBudgetLineDialog();

    expect(mockStore.createBudgetLineSpread).toHaveBeenCalledWith(spread);
    expect(mockStore.createBudgetLine).not.toHaveBeenCalled();
  });

  it('shows the server motive when a postpone is refused', async () => {
    mockDialogService.confirmPostpone.mockResolvedValue(true);
    mockStore.nextMonthLabel.set('septembre 2026');
    mockStore.postponeBudgetLine.mockResolvedValue(
      'Le mois suivant est déjà clôturé',
    );

    await component['handlePostponeBudgetLine']('line-1');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Le mois suivant est déjà clôturé',
      expect.anything(),
      expect.objectContaining({ panelClass: expect.anything() }),
    );
  });

  it('confirms the move when a postpone goes through', async () => {
    mockDialogService.confirmPostpone.mockResolvedValue(true);
    mockStore.nextMonthLabel.set('septembre 2026');

    await component['handlePostponeBudgetLine']('line-1');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      expect.stringContaining('septembre 2026'),
      expect.anything(),
      expect.objectContaining({ duration: 5000 }),
    );
  });
});

describe('BudgetItemsContainer — a refused gesture speaks for itself', () => {
  const LINE_ID = '55555555-5555-4555-8555-555555555555';
  const TX_ID = '66666666-6666-4666-8666-666666666666';
  const MOTIVE = 'Le mois est clôturé';

  let mockStore: MockStore;
  let mockDialogService: MockDialogService;
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let component: BudgetItemsContainer;

  // Every gesture reworked in this phase: the mutation it drives, how the user
  // reaches it, and the confirmation it opens once the mutation goes through.
  const gestures: {
    name: string;
    mutation: () => ReturnType<typeof vi.fn>;
    arrange: () => void;
    act: () => Promise<void>;
    confirmation?: string;
    // The 3 check mutations answer with a 3-way CheckOutcome, not `string | null`.
    isCheckOutcome?: boolean;
  }[] = [
    {
      name: 'deleting a transaction',
      mutation: () => mockStore.deleteTransaction,
      arrange: () => mockDialogService.confirmDelete.mockResolvedValue(true),
      act: () =>
        component['handleDeleteTransaction'](
          createMockTransaction({ id: TX_ID }),
        ),
      confirmation: 'Transaction supprimée',
    },
    {
      name: 'resetting a forecast from the template',
      mutation: () => mockStore.resetBudgetLineFromTemplate,
      arrange: () => undefined,
      act: () => component['handleResetFromTemplate'](LINE_ID),
      confirmation: 'Prévision réinitialisée depuis le modèle',
    },
    {
      name: 'deleting a forecast from the table',
      mutation: () => mockStore.deleteBudgetLine,
      arrange: () => {
        mockStore.budgetDetails.set({
          budgetLines: [createMockBudgetLine({ id: LINE_ID })],
          transactions: [],
        });
        mockDialogService.confirmDelete.mockResolvedValue(true);
      },
      act: () => component['handleDeleteItem'](LINE_ID),
    },
    {
      name: 'checking a transaction',
      mutation: () => mockStore.toggleTransactionCheck,
      arrange: () => undefined,
      act: () => component['handleToggleTransactionCheck'](TX_ID),
      isCheckOutcome: true,
    },
    {
      name: 'cascading the check to allocated transactions',
      mutation: () => mockStore.checkAllAllocatedTransactions,
      isCheckOutcome: true,
      arrange: () => {
        mockStore.budgetDetails.set({
          budgetLines: [createMockBudgetLine({ id: LINE_ID, checkedAt: null })],
          transactions: [
            createMockTransaction({
              id: TX_ID,
              budgetLineId: LINE_ID,
              checkedAt: null,
            }),
          ],
        });
        mockDialogService.confirmCheckAllocatedTransactions.mockResolvedValue(
          true,
        );
      },
      act: () => component['handleToggleCheck'](LINE_ID),
    },
  ];

  beforeEach(() => {
    mockStore = createMockStore();
    mockDialogService = createMockDialogService();
    mockSnackBar = { open: vi.fn() };
    component = setupComponent(
      mockStore,
      mockDialogService,
      mockSnackBar,
    ).componentInstance;
  });

  it.each(gestures)(
    'reports the server motive and nothing else when $name is refused',
    async ({ mutation, arrange, act, isCheckOutcome }) => {
      arrange();
      mutation().mockResolvedValue(
        isCheckOutcome ? { status: 'failed', reason: MOTIVE } : MOTIVE,
      );

      await act();

      expect(mockSnackBar.open).toHaveBeenCalledTimes(1);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        MOTIVE,
        'Fermer',
        expect.objectContaining({
          panelClass: ['bg-error-container', 'text-on-error-container'],
        }),
      );
    },
  );

  it('announces a refused spread of an existing forecast', async () => {
    const line = createMockBudgetLine({ id: LINE_ID, amount: 600 });
    mockStore.budgetDetails.set({ id: 'budget-1', month: 1, year: 2026 });
    mockStore.filteredBudgetLines.set([line]);
    mockDialogService.openSpreadExisting.mockResolvedValue({
      periods: [{ year: 2026, month: 2 }],
    });
    mockStore.spreadExistingBudgetLine.mockResolvedValue({ error: MOTIVE });

    await component['handleSpreadBudgetLine'](component.budgetLineItems()[0]);

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      MOTIVE,
      'Fermer',
      expect.objectContaining({
        panelClass: ['bg-error-container', 'text-on-error-container'],
      }),
    );
  });

  it.each(gestures.filter((gesture) => gesture.confirmation))(
    'keeps the confirmation of $name when it goes through',
    async ({ mutation, arrange, act, confirmation }) => {
      arrange();
      mutation().mockResolvedValue(null);

      await act();

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        confirmation,
        'Fermer',
        expect.anything(),
      );
    },
  );
});

// PUL-329 QA fix — editing a transaction no longer drives a toast off a
// direct store call: the dialog itself owns submission (see
// edit-transaction-dialog.spec.ts for the "stays open on refusal" proof).
// The container's own contract is narrower: hand the dialog a submit closure
// that reaches the right transaction, and toast success only once the dialog
// service call actually resolves with a value (i.e. the dialog closed).
describe('BudgetItemsContainer — editing a transaction (PUL-329)', () => {
  const TX_ID = '88888888-8888-4888-8888-888888888888';

  let mockStore: MockStore;
  let mockDialogService: MockDialogService;
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let component: BudgetItemsContainer;

  beforeEach(() => {
    mockStore = createMockStore();
    mockDialogService = createMockDialogService();
    mockSnackBar = { open: vi.fn() };
    mockStore.budgetDetails.set({ id: 'budget-1', month: 1, year: 2026 });
    component = setupComponent(
      mockStore,
      mockDialogService,
      mockSnackBar,
    ).componentInstance;
  });

  it('supplies a submit closure that routes straight to this transaction’s mutation', async () => {
    const transaction = createMockTransaction({ id: TX_ID });
    const update = { amount: 42 } as TransactionUpdate;
    mockStore.updateTransaction.mockResolvedValue(null);
    mockDialogService.openEditAllocatedTransactionDialog.mockImplementation(
      async (
        _tx: unknown,
        _period: unknown,
        submit: (u: TransactionUpdate) => Promise<string | null>,
      ) => submit(update).then(() => update),
    );

    await component['handleEditAllocatedTransaction'](transaction);

    expect(mockStore.updateTransaction).toHaveBeenCalledWith(TX_ID, update);
  });

  it('toasts success only once the dialog actually closes', async () => {
    const transaction = createMockTransaction({ id: TX_ID });
    mockDialogService.openEditAllocatedTransactionDialog.mockResolvedValue({
      amount: 42,
    });

    await component['handleEditAllocatedTransaction'](transaction);

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Modification enregistrée',
      'Fermer',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('shows no toast when the dialog stays open (a 422 refusal never resolves as a close)', async () => {
    const transaction = createMockTransaction({ id: TX_ID });
    const update = { amount: 42 } as TransactionUpdate;
    mockStore.updateTransaction.mockResolvedValue('Solde insuffisant');
    mockDialogService.openEditAllocatedTransactionDialog.mockImplementation(
      async (
        _tx: unknown,
        _period: unknown,
        submit: (u: TransactionUpdate) => Promise<string | null>,
      ) => {
        await submit(update);
        // A refused mutation keeps the dialog open — it never resolves as a close.
        return undefined;
      },
    );

    await component['handleEditAllocatedTransaction'](transaction);

    expect(mockStore.updateTransaction).toHaveBeenCalledWith(TX_ID, update);
    expect(mockSnackBar.open).not.toHaveBeenCalled();
  });
});

// PUL-329 v2 — a forecast income carrying `sourceSavingsGoalId` is an ANNOUNCED
// withdrawal: nothing leaves the pot until a real income is allocated to it, so
// the check gesture opens that entry instead of pointing the forecast. Creation
// follows the same dialog-owns-submission contract as the edit flow above.
describe('BudgetItemsContainer — realizing an announced withdrawal (PUL-329 v2)', () => {
  const LINE_ID = '99999999-9999-4999-8999-999999999999';
  const GOAL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  let mockStore: MockStore;
  let mockDialogService: MockDialogService;
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let component: BudgetItemsContainer;

  const sourceLine = (overrides = {}) =>
    createMockBudgetLine({
      id: LINE_ID,
      kind: 'income',
      amount: 500,
      sourceSavingsGoalId: GOAL_ID,
      sourceSavingsGoalName: "Fonds d'urgence",
      ...overrides,
    });

  beforeEach(() => {
    mockStore = createMockStore();
    mockDialogService = createMockDialogService();
    mockSnackBar = { open: vi.fn() };
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 1,
      year: 2026,
      budgetLines: [sourceLine()],
      transactions: [],
    });
    component = setupComponent(
      mockStore,
      mockDialogService,
      mockSnackBar,
    ).componentInstance;
  });

  it('opens the real-income entry instead of pointing the forecast', async () => {
    await component['handleToggleCheck'](LINE_ID);

    expect(mockStore.toggleCheck).not.toHaveBeenCalled();
    expect(
      mockDialogService.openCreateAllocatedTransactionDialog,
    ).toHaveBeenCalled();
  });

  it('prefills what is left to take out, allocated reals deducted', async () => {
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 1,
      year: 2026,
      budgetLines: [sourceLine()],
      transactions: [
        createMockTransaction({ budgetLineId: LINE_ID, amount: 300 }),
      ],
    });

    await component['handleToggleCheck'](LINE_ID);

    const realization =
      mockDialogService.openCreateAllocatedTransactionDialog.mock.calls[0][4];
    expect(realization).toEqual({
      goalId: GOAL_ID,
      goalName: "Fonds d'urgence",
      remainingAmount: 200,
    });
  });

  it('floors the remainder at zero once the forecast is over-realized', async () => {
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 1,
      year: 2026,
      budgetLines: [sourceLine()],
      transactions: [
        createMockTransaction({ budgetLineId: LINE_ID, amount: 600 }),
      ],
    });

    await component['handleToggleCheck'](LINE_ID);

    expect(
      mockDialogService.openCreateAllocatedTransactionDialog.mock.calls[0][4],
    ).toMatchObject({ remainingAmount: 0 });
  });

  it('leaves an orphan source on the ordinary toggle, like the backend does', async () => {
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 1,
      year: 2026,
      budgetLines: [sourceLine({ sourceSavingsGoalId: null, checkedAt: null })],
      transactions: [],
    });
    mockStore.toggleCheck.mockResolvedValue({ status: 'succeeded' });

    await component['handleToggleCheck'](LINE_ID);

    expect(mockStore.toggleCheck).toHaveBeenCalledWith(LINE_ID);
    expect(
      mockDialogService.openCreateAllocatedTransactionDialog,
    ).not.toHaveBeenCalled();
  });

  it('offers no realization context on an orphan source, only the ordinary form', async () => {
    const orphan = sourceLine({ sourceSavingsGoalId: null });
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 1,
      year: 2026,
      budgetLines: [orphan],
      transactions: [],
    });

    await component['openCreateAllocatedTransactionDialog'](orphan);

    expect(
      mockDialogService.openCreateAllocatedTransactionDialog.mock.calls[0][4],
    ).toBeNull();
  });

  it('supplies a submit closure that routes straight to the create mutation', async () => {
    const created = { name: 'Apport cuisine', amount: 500 };
    mockStore.createAllocatedTransaction.mockResolvedValue(null);
    mockDialogService.openCreateAllocatedTransactionDialog.mockImplementation(
      async (
        _line: unknown,
        _isMobile: unknown,
        _period: unknown,
        submit: (tx: unknown) => Promise<string | null>,
      ) => submit(created).then(() => created),
    );

    await component['handleToggleCheck'](LINE_ID);

    expect(mockStore.createAllocatedTransaction).toHaveBeenCalledWith(created);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Transaction ajoutée',
      'Fermer',
      expect.objectContaining({ duration: 3000 }),
    );
  });

  it('shows no toast when a refusal keeps the dialog open', async () => {
    mockStore.createAllocatedTransaction.mockResolvedValue(
      'Ce montant dépasse ce que contient l’objectif.',
    );
    mockDialogService.openCreateAllocatedTransactionDialog.mockImplementation(
      async (
        _line: unknown,
        _isMobile: unknown,
        _period: unknown,
        submit: (tx: unknown) => Promise<string | null>,
      ) => {
        await submit({ name: 'Apport cuisine', amount: 500 });
        // A refused mutation keeps the dialog open — it never resolves as a close.
        return undefined;
      },
    );

    await component['handleToggleCheck'](LINE_ID);

    expect(mockStore.createAllocatedTransaction).toHaveBeenCalled();
    expect(mockSnackBar.open).not.toHaveBeenCalled();
  });
});

describe('BudgetItemsContainer — a skipped check stays silent', () => {
  it('opens no toast when the store reports the toggle as skipped', async () => {
    const lineId = '77777777-7777-4777-8777-777777777777';
    const mockStore = createMockStore();
    // checkedAt is set so the confirmation snackbar WOULD have a message to show
    // if the container mistakenly fell through past the `skipped` outcome.
    mockStore.budgetDetails.set({
      budgetLines: [
        createMockBudgetLine({
          id: lineId,
          checkedAt: '2024-01-01T00:00:00Z',
        }),
      ],
      transactions: [],
    });
    mockStore.toggleCheck.mockResolvedValue({ status: 'skipped' });
    const mockSnackBar = { open: vi.fn() };
    const component = setupComponent(
      mockStore,
      createMockDialogService(),
      mockSnackBar,
    ).componentInstance;

    await component['handleToggleCheck'](lineId);

    expect(mockSnackBar.open).not.toHaveBeenCalled();
  });
});

describe('BudgetItemsContainer — tag history', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const tags = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      userId,
      name: 'Courses',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      userId,
      name: 'Maison',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ];

  it('keeps the action available without tagged items and passes the budget anchor', () => {
    const mockStore = createMockStore();
    const mockDialogService = createMockDialogService();
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 7,
      year: 2026,
      budgetLines: [],
      transactions: [],
    });
    mockStore.searchText.set('not-found');
    const fixture = setupComponent(
      mockStore,
      mockDialogService,
      { open: vi.fn() },
      createMockTagStore(tags),
    );
    fixture.detectChanges();

    const action: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('[data-testid="tag-history-open"]');
    expect(action).not.toBeNull();
    action?.click();

    expect(mockDialogService.openTagHistory).toHaveBeenCalledWith({
      tags,
      selectedTagId: undefined,
      endMonth: 7,
      endYear: 2026,
      currency: 'CHF',
    });
  });

  it('preserves the single active tag filter as the dialog selection', () => {
    const mockStore = createMockStore();
    const mockDialogService = createMockDialogService();
    mockStore.budgetDetails.set({
      id: 'budget-1',
      month: 6,
      year: 2026,
      budgetLines: [],
      transactions: [],
    });
    mockStore.searchText.set('not-found');
    const fixture = setupComponent(
      mockStore,
      mockDialogService,
      { open: vi.fn() },
      createMockTagStore(tags),
    );
    fixture.componentInstance.selectedTagIds.set([tags[1].id]);
    fixture.detectChanges();

    fixture.componentInstance['openTagHistoryDialog']();

    expect(mockDialogService.openTagHistory).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTagId: tags[1].id }),
    );
  });

  it('preserves tag filters when reloading the same budget and clears them when navigating to another budget', () => {
    const mockStore = createMockStore();
    mockStore.budgetDetails.set({
      id: 'budget-1',
      budgetLines: [],
      transactions: [],
    });
    mockStore.searchText.set('not-found');
    const fixture = setupComponent(
      mockStore,
      createMockDialogService(),
      { open: vi.fn() },
      createMockTagStore(tags),
    );
    TestBed.flushEffects();
    fixture.componentInstance.selectedTagIds.set([tags[0].id]);

    mockStore.budgetDetails.set(null);
    TestBed.flushEffects();
    mockStore.budgetDetails.set({
      id: 'budget-1',
      budgetLines: [],
      transactions: [],
    });
    TestBed.flushEffects();
    expect(fixture.componentInstance.selectedTagIds()).toEqual([tags[0].id]);

    mockStore.budgetDetails.set({
      id: 'budget-2',
      budgetLines: [],
      transactions: [],
    });
    TestBed.flushEffects();
    expect(fixture.componentInstance.selectedTagIds()).toEqual([]);
  });
});

describe('BudgetItemsContainer — PATCH transaction body contract', () => {
  const BUDGET_ID = '11111111-1111-4111-8111-111111111111';
  const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';
  const BUDGET_LINE_ID = '33333333-3333-4333-8333-333333333333';

  let mockStore: MockStore;
  let mockDialogService: MockDialogService;
  let httpTesting: HttpTestingController;
  let fixture: ComponentFixture<BudgetItemsContainer>;
  let component: BudgetItemsContainer;

  beforeEach(() => {
    // Mock the store but route updateTransaction through the REAL
    // BudgetApi -> TransactionApi -> ApiClient chain to assert on the actual
    // PATCH body. Keeps the TestBed free of BudgetDetailsStore's transitive
    // deps (PostHog, AmountsVisibility, UserSettings).
    mockStore = createMockStore();
    mockDialogService = createMockDialogService();

    const envelopesStorageMock = {
      getString: () => 'envelopes',
      setString: () => undefined,
      get: () => null,
      set: () => undefined,
      remove: () => undefined,
    };

    TestBed.configureTestingModule({
      imports: [BudgetItemsContainer, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideTranslocoForTest(),
        { provide: StorageService, useValue: envelopesStorageMock },
        { provide: BudgetDetailsStore, useValue: mockStore },
        { provide: BudgetDetailsDialogService, useValue: mockDialogService },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: UserSettingsStore,
          useValue: {
            currency: signal('CHF'),
            payDayOfMonth: signal(1),
          },
        },
        { provide: Logger, useValue: createMockLogger() },
        {
          provide: ApplicationConfiguration,
          useValue: { backendApiUrl: () => 'http://localhost:3000/api/v1' },
        },
        { provide: TagStore, useValue: createMockTagStore() },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);

    const realBudgetApi = TestBed.inject(BudgetApi);
    mockStore.updateTransaction.mockImplementation(
      async (id: string, payload: TransactionUpdate): Promise<void> => {
        await firstValueFrom(realBudgetApi.updateTransaction$(id, payload));
      },
    );

    fixture = TestBed.createComponent(BudgetItemsContainer);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should send PATCH /transactions/:id without an id key in body and match transactionUpdateSchema', async () => {
    mockStore.budgetDetails.set({
      id: BUDGET_ID,
      month: 5,
      year: 2026,
    });
    const transaction = createMockTransaction({
      id: TRANSACTION_ID,
      budgetId: BUDGET_ID,
      budgetLineId: BUDGET_LINE_ID,
      name: 'Original',
      amount: 5,
      kind: 'expense',
      transactionDate: '2026-05-01T00:00:00.000Z',
    });
    const update: TransactionUpdate = {
      name: 'Updated name',
      amount: 42,
      kind: 'expense',
      transactionDate: '2026-05-06T00:00:00.000Z',
      tagIds: [],
    };
    // Simulates the real dialog: it calls the submit closure the container
    // handed it (3rd arg) and only "closes" (resolves) once that succeeds.
    mockDialogService.openEditAllocatedTransactionDialog.mockImplementation(
      async (
        _tx: unknown,
        _period: unknown,
        submit: (u: TransactionUpdate) => Promise<string | null>,
      ) => {
        const error = await submit(update);
        return error ? undefined : update;
      },
    );

    const editPromise =
      component['handleEditAllocatedTransaction'](transaction);

    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    const req = httpTesting.expectOne(
      (request) =>
        request.method === 'PATCH' &&
        request.url.endsWith(`/transactions/${TRANSACTION_ID}`),
    );

    expect(req.request.body).not.toHaveProperty('id');
    expect(transactionUpdateSchema.safeParse(req.request.body).success).toBe(
      true,
    );
    expect(req.request.body).toEqual(update);

    req.flush({
      success: true,
      data: createMockTransaction({
        ...transaction,
        ...update,
        updatedAt: '2026-05-06T00:00:00.000Z',
      }),
    });

    await editPromise;
  });
});
