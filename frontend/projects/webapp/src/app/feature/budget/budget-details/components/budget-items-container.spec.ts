import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { createMockTransaction } from '@app/testing/mock-factories';
import { createMockLogger } from '@app/testing/mock-posthog';
import { StorageService } from '@core/storage';
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
  setSearchText: ReturnType<typeof vi.fn>;
  setIsShowingOnlyUnchecked: ReturnType<typeof vi.fn>;
  createBudgetLine: ReturnType<typeof vi.fn>;
  updateBudgetLine: ReturnType<typeof vi.fn>;
  deleteBudgetLine: ReturnType<typeof vi.fn>;
  deleteTransaction: ReturnType<typeof vi.fn>;
  resetBudgetLineFromTemplate: ReturnType<typeof vi.fn>;
  toggleCheck: ReturnType<typeof vi.fn>;
  toggleTransactionCheck: ReturnType<typeof vi.fn>;
  checkAllAllocatedTransactions: ReturnType<typeof vi.fn>;
  createAllocatedTransaction: ReturnType<typeof vi.fn>;
  updateTransaction: ReturnType<typeof vi.fn>;
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
    setSearchText: vi.fn(),
    setIsShowingOnlyUnchecked: vi.fn(),
    createBudgetLine: vi.fn(),
    updateBudgetLine: vi.fn(),
    deleteBudgetLine: vi.fn(),
    deleteTransaction: vi.fn(),
    resetBudgetLineFromTemplate: vi.fn(),
    toggleCheck: vi.fn().mockResolvedValue(true),
    toggleTransactionCheck: vi.fn(),
    checkAllAllocatedTransactions: vi.fn(),
    createAllocatedTransaction: vi.fn(),
    updateTransaction: vi.fn(),
  };
}

interface MockDialogService {
  openAddBudgetLineDialog: ReturnType<typeof vi.fn>;
  openEditBudgetLineDialog: ReturnType<typeof vi.fn>;
  openAllocatedTransactionsDialog: ReturnType<typeof vi.fn>;
  openCreateAllocatedTransactionDialog: ReturnType<typeof vi.fn>;
  openEditAllocatedTransactionDialog: ReturnType<typeof vi.fn>;
  confirmDelete: ReturnType<typeof vi.fn>;
  confirmCheckAllocatedTransactions: ReturnType<typeof vi.fn>;
}

function createMockDialogService(): MockDialogService {
  return {
    openAddBudgetLineDialog: vi.fn().mockResolvedValue(undefined),
    openEditBudgetLineDialog: vi.fn().mockResolvedValue(undefined),
    openAllocatedTransactionsDialog: vi.fn().mockResolvedValue(undefined),
    openCreateAllocatedTransactionDialog: vi.fn().mockResolvedValue(undefined),
    openEditAllocatedTransactionDialog: vi.fn().mockResolvedValue(undefined),
    confirmDelete: vi.fn().mockResolvedValue(false),
    confirmCheckAllocatedTransactions: vi.fn().mockResolvedValue(false),
  };
}

function setupComponent(
  mockStore: MockStore,
  mockDialogService: MockDialogService,
  mockSnackBar: { open: ReturnType<typeof vi.fn> },
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

  it('creates a budget line when add dialog returns a value', async () => {
    mockStore.budgetDetails.set({ id: 'budget-1', month: 1, year: 2026 });
    const newLine = { name: 'Loyer', amount: 100 };
    mockDialogService.openAddBudgetLineDialog.mockResolvedValue(newLine);

    await component.openAddBudgetLineDialog();

    expect(mockDialogService.openAddBudgetLineDialog).toHaveBeenCalledWith(
      'budget-1',
    );
    expect(mockStore.createBudgetLine).toHaveBeenCalledWith(newLine);
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
      category: null,
    };
    mockDialogService.openEditAllocatedTransactionDialog.mockResolvedValue({
      id: transaction.id,
      update,
    });

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
