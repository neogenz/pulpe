import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { delay, of, switchMap, throwError } from 'rxjs';
import type {
  TransactionSearchResult,
  TransactionSearchResponse,
} from 'pulpe-shared';
import { TransactionApi } from '@core/transaction/transaction-api';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';
import { TagStore } from '@core/tag';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import SearchTransactionsDialogComponent from './search-transactions-dialog';

const TAG_ID = '4df3df43-2b73-467a-a7ac-322f3ab8ed49';
const USER_ID = '96bd5e0e-0ae4-46f4-a776-908f7c2ae21e';

function buildSearchResult(
  overrides: Partial<TransactionSearchResult> = {},
): TransactionSearchResult {
  return {
    id: crypto.randomUUID(),
    itemType: 'transaction',
    name: 'Test transaction',
    amount: 100,
    kind: 'expense',
    recurrence: null,
    transactionDate: null,
    budgetId: crypto.randomUUID(),
    budgetName: 'Budget 2024',
    year: 2024,
    month: 1,
    monthLabel: 'Janvier',
    ...overrides,
  };
}

function buildSearchResponse(
  data: TransactionSearchResult[] = [],
): TransactionSearchResponse {
  return { success: true, data };
}

describe('SearchTransactionsDialogComponent', () => {
  let fixture: ComponentFixture<SearchTransactionsDialogComponent>;
  let component: SearchTransactionsDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockTransactionApi: { search$: ReturnType<typeof vi.fn> };
  let mockBudgetApi: { getAllBudgets$: ReturnType<typeof vi.fn> };
  let mockTagStore: {
    tags: {
      value: ReturnType<typeof signal>;
      status: ReturnType<typeof signal<'resolved' | 'error'>>;
    };
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  function typeInSearchInput(text: string): void {
    const input = fixture.nativeElement.querySelector(
      '[data-testid="search-input"]',
    ) as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function getSearchResultRows(): NodeListOf<HTMLTableRowElement> {
    return fixture.nativeElement.querySelectorAll(
      '[data-testid="search-results-table"] tbody tr',
    );
  }

  function getResultsTable(): HTMLElement | null {
    return fixture.nativeElement.querySelector(
      '[data-testid="search-results-table"]',
    );
  }

  function getClearButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button[aria-label="Effacer"]');
  }

  function getSearchInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="search-input"]',
    ) as HTMLInputElement;
  }

  function getVisibleStateText(): string {
    return (fixture.nativeElement.textContent ?? '').trim();
  }

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn(),
    };

    mockTransactionApi = {
      search$: vi.fn().mockReturnValue(of(buildSearchResponse())),
    };

    mockBudgetApi = {
      getAllBudgets$: vi.fn().mockReturnValue(
        of([
          { year: 2024, month: 1 },
          { year: 2024, month: 2 },
          { year: 2023, month: 12 },
        ]),
      ),
    };

    mockTagStore = {
      tags: {
        value: signal([
          {
            id: TAG_ID,
            userId: USER_ID,
            name: 'Courses',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
        status: signal<'resolved' | 'error'>('resolved'),
      },
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SearchTransactionsDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
        { provide: TagStore, useValue: mockTagStore },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchTransactionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Component Structure', () => {
    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have a search input', () => {
      const input = fixture.nativeElement.querySelector(
        '[data-testid="search-input"]',
      );
      expect(input).toBeTruthy();
    });

    it('should have a year filter select', () => {
      const select = fixture.nativeElement.querySelector(
        '[data-testid="year-filter"]',
      );
      expect(select).toBeTruthy();
    });

    it('should have a tag filter select', () => {
      const select = fixture.nativeElement.querySelector(
        '[data-testid="tag-filter"]',
      );
      expect(select).toBeTruthy();
    });
  });

  describe('Available Years Loading', () => {
    it('should call getAllBudgets$ to load available years', () => {
      expect(mockBudgetApi.getAllBudgets$).toHaveBeenCalled();
    });

    it('should render year options sorted descending', async () => {
      await vi.waitFor(() => {
        fixture.detectChanges();
        const trigger = fixture.nativeElement.querySelector(
          '[data-testid="year-filter"] .mat-mdc-select-trigger',
        ) as HTMLElement;
        expect(trigger).toBeTruthy();
      });

      const trigger = fixture.nativeElement.querySelector(
        '[data-testid="year-filter"] .mat-mdc-select-trigger',
      ) as HTMLElement;
      trigger.click();
      fixture.detectChanges();

      await vi.waitFor(() => {
        const options = document.querySelectorAll(
          '.cdk-overlay-container mat-option',
        );
        expect(options.length).toBe(2);
        expect(options[0].textContent!.trim()).toBe('2024');
        expect(options[1].textContent!.trim()).toBe('2023');
      });
    });

    it('should show error hint when year loading fails', async () => {
      mockBudgetApi.getAllBudgets$.mockReturnValue(
        of(null).pipe(
          delay(0),
          switchMap(() => throwError(() => new Error('Network error'))),
        ),
      );

      const newFixture = TestBed.createComponent(
        SearchTransactionsDialogComponent,
      );
      newFixture.detectChanges();

      await vi.waitFor(() => {
        newFixture.detectChanges();
        const hint = newFixture.nativeElement.querySelector('mat-hint');
        expect(hint?.textContent).toContain('Erreur de chargement');
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Search Behavior', () => {
    it('should not show results when query has fewer than 2 characters', async () => {
      typeInSearchInput('a');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getResultsTable()).toBeNull();
      });
    });

    it('should display search results for a valid query', async () => {
      const results = [
        buildSearchResult({ name: 'Loyer', amount: 1200 }),
        buildSearchResult({ name: 'Courses', amount: 250 }),
      ];
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse(results)),
      );

      typeInSearchInput('Lo');

      await vi.waitFor(() => {
        fixture.detectChanges();
        const rows = getSearchResultRows();
        expect(rows.length).toBe(2);
      });
      expect(mockTransactionApi.search$).toHaveBeenCalledWith({
        q: 'Lo',
        years: undefined,
        tagIds: undefined,
      });
    });

    it('should pass selected years to search API', async () => {
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse([buildSearchResult()])),
      );

      // Pragmatic: set year filter via signal (mat-select multiple is complex to interact with via DOM)
      component['filterForm'].years().value.set([2024]);
      typeInSearchInput('Test');

      await vi.waitFor(() => {
        fixture.detectChanges();
        const rows = getSearchResultRows();
        expect(rows.length).toBe(1);
      });
      expect(mockTransactionApi.search$).toHaveBeenCalledWith({
        q: 'Test',
        years: [2024],
        tagIds: undefined,
      });
    });

    it('should search by tag without a text query', async () => {
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse([buildSearchResult()])),
      );

      component['filterForm'].tagIds().value.set([TAG_ID]);

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getSearchResultRows().length).toBe(1);
      });
      expect(mockTransactionApi.search$).toHaveBeenCalledWith({
        q: undefined,
        years: undefined,
        tagIds: [TAG_ID],
      });
    });

    it('should keep text search available when tags fail to load', async () => {
      mockTagStore.tags.status.set('error');
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse([buildSearchResult()])),
      );

      typeInSearchInput('Test');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getVisibleStateText()).toContain('Tags indisponibles');
        expect(getSearchResultRows().length).toBe(1);
      });
    });

    it('should show initial prompt when query is too short', () => {
      typeInSearchInput('a');
      fixture.detectChanges();

      const text = getVisibleStateText();
      expect(text).toContain('Recherche dans tes budgets');
    });

    it('should show no-results message when search returns empty', async () => {
      mockTransactionApi.search$.mockReturnValue(of(buildSearchResponse([])));

      typeInSearchInput('ab');

      await vi.waitFor(() => {
        fixture.detectChanges();
        const text = getVisibleStateText();
        expect(text).toContain('Pas de résultat');
      });
    });
  });

  describe('Search Error Handling', () => {
    it('should show error message when search fails', async () => {
      mockTransactionApi.search$.mockReturnValue(
        of(null).pipe(
          delay(0),
          switchMap(() => throwError(() => new Error('Search failed'))),
        ),
      );

      typeInSearchInput('test');

      await vi.waitFor(() => {
        fixture.detectChanges();
        const text = getVisibleStateText();
        expect(text).toContain('Erreur lors de la recherche');
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not show results table when search fails', async () => {
      mockTransactionApi.search$.mockReturnValue(
        of(null).pipe(
          delay(0),
          switchMap(() => throwError(() => new Error('Search failed'))),
        ),
      );

      typeInSearchInput('test');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getResultsTable()).toBeNull();
        expect(getVisibleStateText()).toContain('Erreur lors de la recherche');
      });
    });
  });

  describe('Result Selection', () => {
    it('should close dialog when clicking a result row', async () => {
      const result = buildSearchResult({ name: 'Loyer' });
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse([result])),
      );

      typeInSearchInput('Lo');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getSearchResultRows().length).toBe(1);
      });

      const row = getSearchResultRows()[0];
      row.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Loyer' }),
      );
    });
  });

  describe('Clear Search', () => {
    it('should clear input when clicking clear button', async () => {
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse([buildSearchResult()])),
      );

      typeInSearchInput('some query');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getClearButton()).toBeTruthy();
      });

      getClearButton()!.click();
      fixture.detectChanges();

      expect(getSearchInput().value).toBe('');
    });

    it('should remove results after clearing search', async () => {
      const results = [buildSearchResult()];
      mockTransactionApi.search$.mockReturnValue(
        of(buildSearchResponse(results)),
      );

      typeInSearchInput('test');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getSearchResultRows().length).toBe(1);
      });

      getClearButton()!.click();
      fixture.detectChanges();

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(getResultsTable()).toBeNull();
      });
    });
  });
});
