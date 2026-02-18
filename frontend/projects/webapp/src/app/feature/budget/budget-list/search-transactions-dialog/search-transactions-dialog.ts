import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { debounce, Field, form } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { TransactionSearchResult } from 'pulpe-shared';
import { TransactionApi } from '@core/transaction/transaction-api';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-search-transactions-dialog',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    Field,
    CurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>Rechercher dans le budget</h2>

    <mat-dialog-content class="flex flex-col gap-4 pt-2!">
      <div class="flex flex-col sm:flex-row gap-4">
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="flex-1"
        >
          <mat-label>Rechercher</mat-label>
          @if (searchResource.isLoading()) {
            <mat-progress-spinner
              matIconPrefix
              mode="indeterminate"
              [diameter]="20"
              class="mx-4"
            />
          } @else {
            <mat-icon matIconPrefix>search</mat-icon>
          }
          <input
            matInput
            [field]="filterForm.query"
            placeholder="Nom ou description..."
            autocomplete="off"
            data-testid="search-input"
          />
          @if (filterForm.query().value()) {
            <button
              matIconButton
              matIconSuffix
              (click)="clearSearch()"
              aria-label="Effacer"
              type="button"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="sm:w-48"
        >
          <mat-label>Filtrer par année</mat-label>
          <mat-select
            [field]="filterForm.years"
            multiple
            data-testid="year-filter"
          >
            @for (year of availableYears(); track year) {
              <mat-option [value]="year">{{ year }}</mat-option>
            }
          </mat-select>
          @if (availableYearsResource.error()) {
            <mat-hint class="text-error">Erreur de chargement</mat-hint>
          }
        </mat-form-field>
      </div>

      @if (searchResults().length > 0) {
        <div
          class="overflow-auto transition-opacity duration-150"
          [class.opacity-60]="searchResource.isLoading()"
        >
          <table
            mat-table
            [dataSource]="searchResults()"
            class="w-full"
            data-testid="search-results-table"
          >
            <ng-container matColumnDef="period">
              <th mat-header-cell *matHeaderCellDef>Période</th>
              <td
                mat-cell
                *matCellDef="let row"
                class="text-body-small text-on-surface-variant"
              >
                {{ row.year }} / {{ row.monthLabel }}
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nom</th>
              <td
                mat-cell
                *matCellDef="let row"
                class="text-body-medium"
                [class.text-financial-income]="row.kind === 'income'"
                [class.text-financial-expense]="row.kind === 'expense'"
                [class.text-financial-savings]="row.kind === 'saving'"
              >
                {{ row.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="text-right">
                Montant
              </th>
              <td
                mat-cell
                *matCellDef="let row"
                class="text-right text-body-medium font-bold"
                [class.text-financial-income]="row.kind === 'income'"
                [class.text-financial-expense]="row.kind === 'expense'"
                [class.text-financial-savings]="row.kind === 'saving'"
              >
                {{ row.amount | currency: 'CHF' : 'symbol' : '1.2-2' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayedColumns"
              (click)="selectResult(row)"
              class="cursor-pointer hover:bg-surface-container-highest"
            ></tr>
          </table>
        </div>
      } @else if (searchResource.error()) {
        <div class="text-center py-8 text-error">
          <mat-icon class="text-5xl! w-auto! h-auto! mb-2"
            >error_outline</mat-icon
          >
          <p class="text-body-medium">Erreur lors de la recherche</p>
          <p class="text-body-small">Réessaie plus tard</p>
        </div>
      } @else if (searchResource.isLoading()) {
        <div class="flex flex-col items-center justify-center py-8 gap-2">
          <mat-progress-spinner mode="indeterminate" [diameter]="40" />
          <span class="text-body-medium text-on-surface-variant">
            Recherche en cours...
          </span>
        </div>
      } @else if (hasSearched()) {
        <div class="text-center py-8 text-on-surface-variant">
          <mat-icon class="text-5xl! w-auto! h-auto! mb-2">search_off</mat-icon>
          <p class="text-body-medium">Pas de résultat</p>
          <p class="text-body-small">Essaie avec un autre terme de recherche</p>
        </div>
      } @else {
        <div class="text-center py-8 text-on-surface-variant">
          <mat-icon class="text-5xl! w-auto! h-auto! mb-2">search</mat-icon>
          <p class="text-body-medium">Recherchez dans vos budgets</p>
          <p class="text-body-small">
            Saisissez au moins 2 caractères pour rechercher dans les prévisions
            et transactions
          </p>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: `
    table {
      background: transparent;
    }

    tr.mat-mdc-row {
      transition: background-color 0.15s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SearchTransactionsDialogComponent {
  readonly #dialogRef = inject(
    MatDialogRef<
      SearchTransactionsDialogComponent,
      TransactionSearchResult | undefined
    >,
  );
  readonly #transactionApi = inject(TransactionApi);
  readonly #budgetApi = inject(BudgetApi);
  readonly #logger = inject(Logger);

  readonly #filterModel = signal({ query: '', years: [] as number[] });
  protected readonly filterForm = form(this.#filterModel, (path) => {
    debounce(path.query, 300);
  });

  protected readonly availableYearsResource = resource({
    loader: async () => {
      try {
        const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
        const years = [...new Set(budgets.map((b) => b.year))];
        return [...years].sort((a, b) => b - a);
      } catch (err) {
        this.#logger.error('Failed to load years', err);
        throw err;
      }
    },
  });

  readonly #validQuery = computed(() => {
    const query = this.filterForm.query().value().trim();
    return query.length >= 2 ? query : null;
  });

  protected readonly selectedYears = computed(() =>
    this.filterForm.years().value(),
  );

  protected readonly searchResource = resource({
    params: () => ({ query: this.#validQuery(), years: this.selectedYears() }),
    loader: async ({ params }) => {
      if (!params.query) {
        return { success: true as const, data: [] };
      }
      const years = params.years.length > 0 ? params.years : undefined;
      try {
        return await firstValueFrom(
          this.#transactionApi.search$(params.query, years),
        );
      } catch (err) {
        this.#logger.error('Search error', err);
        throw err;
      }
    },
  });

  protected readonly availableYears = computed(() =>
    this.availableYearsResource.error()
      ? []
      : (this.availableYearsResource.value() ?? []),
  );

  protected readonly searchResults = computed(() =>
    this.searchResource.error()
      ? []
      : (this.searchResource.value()?.data ?? []),
  );
  protected readonly hasSearched = computed(() => this.#validQuery() !== null);

  protected readonly displayedColumns = ['period', 'name', 'amount'] as const;

  protected clearSearch(): void {
    this.#filterModel.update((model) => ({ ...model, query: '' }));
  }

  protected selectResult(result: TransactionSearchResult): void {
    this.#dialogRef.close(result);
  }
}
