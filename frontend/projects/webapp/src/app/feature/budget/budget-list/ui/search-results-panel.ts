import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { startWith, debounceTime, map } from 'rxjs';
import type {
  BudgetLineSearchResult,
  TransactionSearchResult,
} from '@pulpe/shared';
import { SearchResultItem } from './search-result-item';

export interface SearchResultsData {
  readonly budgetLines: readonly BudgetLineSearchResult[];
  readonly transactions: readonly TransactionSearchResult[];
}

type CombinedSearchResult =
  | { type: 'budgetLine'; data: BudgetLineSearchResult }
  | { type: 'transaction'; data: TransactionSearchResult };

@Component({
  selector: 'pulpe-search-results-panel',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    SearchResultItem,
  ],
  template: `
    <!-- Search Field -->
    <div class="search-container mb-4 md:mb-6">
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Rechercher dans vos budgets</mat-label>
        <input
          matInput
          [formControl]="searchControl"
          placeholder="Nom de dépense, revenu ou transaction..."
          (keydown.enter)="onSearchSubmit()"
          data-testid="budget-search-input"
        />
        <mat-icon matPrefix>search</mat-icon>
        @if (searchControl.value) {
          <button
            matIconButton
            matSuffix
            (click)="clearSearch()"
            aria-label="Effacer la recherche"
            data-testid="clear-search-button"
          >
            <mat-icon>clear</mat-icon>
          </button>
        }
      </mat-form-field>
    </div>

    <!-- Results Container -->
    @if (searchTerm()) {
      <div class="results-container">
        <!-- Loading State -->
        @if (isLoading()) {
          <div class="flex justify-center items-center h-[200px]">
            <mat-progress-spinner
              mode="indeterminate"
              [diameter]="32"
              aria-label="Recherche en cours"
              role="progressbar"
              class="pulpe-loading-indicator pulpe-loading-medium"
            ></mat-progress-spinner>
          </div>
        }
        <!-- Error State -->
        @else if (hasError()) {
          <div
            class="flex flex-col items-center justify-center h-[200px] text-error"
          >
            <mat-icon class="text-display-small mb-2">error_outline</mat-icon>
            <p class="text-label-large">Erreur lors de la recherche</p>
            <button
              matButton="filled"
              (click)="onSearchSubmit()"
              class="mt-4"
            >
              Réessayer
            </button>
          </div>
        }
        <!-- Empty State -->
        @else if (combinedResults().length === 0) {
          <div
            class="flex flex-col items-center justify-center h-[200px] text-on-surface-variant"
          >
            <mat-icon class="text-display-small mb-2">inbox</mat-icon>
            <p class="text-label-large">
              Aucun résultat pour "{{ searchTerm() }}"
            </p>
            <p class="text-body-small">
              Essayez d'autres termes de recherche
            </p>
          </div>
        }
        <!-- Results List -->
        @else {
          <div class="mb-4">
            <p class="text-label-large text-on-surface-variant mb-3">
              {{ getTotalResultsLabel() }}
            </p>
            <div class="results-list space-y-2">
              @for (result of combinedResults(); track result.data.id) {
                <pulpe-search-result-item
                  [result]="result.data"
                  (itemClicked)="onResultClicked(result)"
                  [attr.data-testid]="'search-result-' + result.data.id"
                />
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .results-container {
      min-height: 100px;
    }

    .results-list {
      max-height: 500px;
      overflow-y: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsPanel {
  // Inputs
  searchResults = input<SearchResultsData | null>(null);
  isLoading = input<boolean>(false);
  hasError = input<boolean>(false);

  // Outputs
  searchRequested = output<string>();
  resultSelected = output<{ budgetId: string; type: 'budgetLine' | 'transaction' }>();

  // Local search state
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((term) => term.trim()),
    ),
    { initialValue: '' },
  );

  // Combined and sorted results
  readonly combinedResults = computed((): CombinedSearchResult[] => {
    const results = this.searchResults();
    if (!results) {
      return [];
    }

    const budgetLines: CombinedSearchResult[] = results.budgetLines.map(
      (line) => ({
        type: 'budgetLine' as const,
        data: line,
      }),
    );

    const transactions: CombinedSearchResult[] = results.transactions.map(
      (transaction) => ({
        type: 'transaction' as const,
        data: transaction,
      }),
    );

    // Combine and sort by budget year/month descending
    return [...budgetLines, ...transactions].sort((a, b) => {
      const yearDiff = b.data.budgetYear - a.data.budgetYear;
      if (yearDiff !== 0) return yearDiff;
      return b.data.budgetMonth - a.data.budgetMonth;
    });
  });

  constructor() {
    // Auto-trigger search when term changes (using effect for signals)
    effect(() => {
      const term = this.searchTerm();
      if (term.length >= 2) {
        this.searchRequested.emit(term);
      }
    });
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  onSearchSubmit(): void {
    const term = this.searchControl.value.trim();
    if (term.length >= 2) {
      this.searchRequested.emit(term);
    }
  }

  onResultClicked(result: CombinedSearchResult): void {
    this.resultSelected.emit({
      budgetId: result.data.budgetId,
      type: result.type,
    });
  }

  getTotalResultsLabel(): string {
    const total = this.combinedResults().length;
    const results = this.searchResults();
    if (!results) return '';

    const budgetLinesCount = results.budgetLines.length;
    const transactionsCount = results.transactions.length;

    const parts: string[] = [];
    if (budgetLinesCount > 0) {
      parts.push(
        `${budgetLinesCount} prévision${budgetLinesCount > 1 ? 's' : ''}`,
      );
    }
    if (transactionsCount > 0) {
      parts.push(
        `${transactionsCount} transaction${transactionsCount > 1 ? 's' : ''}`,
      );
    }

    return `${total} résultat${total > 1 ? 's' : ''} (${parts.join(', ')})`;
  }
}
