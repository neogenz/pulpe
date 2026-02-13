import { provideZonelessChangeDetection } from '@angular/core';
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

import SearchTransactionsDialogComponent from './search-transactions-dialog';

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
    category: null,
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
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
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

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SearchTransactionsDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: TransactionApi, useValue: mockTransactionApi },
        { provide: BudgetApi, useValue: mockBudgetApi },
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
      expect(mockTransactionApi.search$).toHaveBeenCalledWith('Lo', undefined);
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
      expect(mockTransactionApi.search$).toHaveBeenCalledWith('Test', [2024]);
    });

    it('should show initial prompt when query is too short', () => {
      typeInSearchInput('a');
      fixture.detectChanges();

      const text = getVisibleStateText();
      expect(text).toContain('Recherchez dans vos budgets');
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
