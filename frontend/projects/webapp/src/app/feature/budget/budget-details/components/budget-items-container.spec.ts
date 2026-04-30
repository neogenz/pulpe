import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { StorageService } from '@core/storage';
import { Logger } from '@core/logging/logger';
import { UserSettingsStore } from '@core/user-settings';
import type { BudgetLine, Transaction } from 'pulpe-shared';
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
