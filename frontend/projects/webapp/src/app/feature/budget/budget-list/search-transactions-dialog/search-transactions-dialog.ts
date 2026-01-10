import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounce, Field, form } from '@angular/forms/signals';
import { catchError, of } from 'rxjs';
import type { TransactionSearchResult } from '@pulpe/shared';
import { TransactionApi } from '@core/transaction/transaction-api';
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
    MatTooltipModule,
    Field,
    CurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title>Rechercher dans le budget</h2>

    <mat-dialog-content class="!max-h-[70vh]">
      <div class="flex flex-col gap-4">
        <!-- Search input -->
        <mat-form-field
          appearance="outline"
          subscriptSizing="dynamic"
          class="w-full"
        >
          <mat-label>Rechercher</mat-label>
          <mat-icon matIconPrefix>search</mat-icon>
          <input
            matInput
            [field]="searchForm.query"
            placeholder="Nom ou description..."
            autocomplete="off"
            data-testid="search-input"
          />
          @if (searchForm.query().value()) {
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

        <!-- Loading state -->
        @if (searchResource.isLoading()) {
          <div class="flex flex-col items-center justify-center py-8 gap-2">
            <mat-progress-spinner
              mode="indeterminate"
              [diameter]="40"
            ></mat-progress-spinner>
            <span class="text-body-medium text-on-surface-variant">
              Recherche en cours...
            </span>
          </div>
        } @else if (searchResults().length > 0) {
          <!-- Results table -->
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

            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef class="!w-10"></th>
              <td mat-cell *matCellDef="let row" class="!w-10">
                <mat-icon
                  class="!text-base text-on-surface-variant"
                  [matTooltip]="
                    row.itemType === 'transaction' ? 'Réel' : 'Prévision'
                  "
                >
                  {{
                    row.itemType === 'transaction' ? 'receipt' : 'event_note'
                  }}
                </mat-icon>
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Nom</th>
              <td mat-cell *matCellDef="let row" class="text-body-medium">
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
                class="text-right text-body-medium font-medium"
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
        } @else if (hasSearched() && !searchResource.isLoading()) {
          <!-- Empty state -->
          <div class="text-center py-8 text-on-surface-variant">
            <mat-icon class="!text-5xl mb-2">search_off</mat-icon>
            <p class="text-body-medium">Aucun résultat trouvé</p>
            <p class="text-body-small">
              Essayez avec un autre terme de recherche
            </p>
          </div>
        } @else {
          <!-- Initial state -->
          <div class="text-center py-8 text-on-surface-variant">
            <mat-icon class="!text-5xl mb-2">search</mat-icon>
            <p class="text-body-medium">Recherchez dans vos budgets</p>
            <p class="text-body-small">
              Saisissez au moins 2 caractères pour rechercher dans les
              prévisions et transactions
            </p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    table {
      background: transparent;
    }

    tr.mat-mdc-row {
      transition: background-color 0.15s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchTransactionsDialogComponent {
  readonly #dialogRef = inject(
    MatDialogRef<
      SearchTransactionsDialogComponent,
      TransactionSearchResult | undefined
    >,
  );
  readonly #transactionApi = inject(TransactionApi);
  readonly #logger = inject(Logger);

  // Signal Forms: data model + form with debounce
  readonly #searchModel = signal({ query: '' });
  readonly searchForm = form(this.#searchModel, (path) => {
    debounce(path.query, 300);
  });

  // Derived: valid search query (>= 2 chars)
  readonly #validQuery = computed(() => {
    const query = this.searchForm.query().value().trim();
    return query.length >= 2 ? query : null;
  });

  // rxResource: auto-cancels previous requests (like switchMap)
  readonly searchResource = rxResource({
    params: () => this.#validQuery(),
    stream: ({ params: query }) => {
      if (!query) {
        return of({ success: true as const, data: [] });
      }
      return this.#transactionApi.search$(query).pipe(
        catchError((error) => {
          this.#logger.error('Search error', error);
          return of({ success: true as const, data: [] });
        }),
      );
    },
  });

  // Derived state from resource
  readonly searchResults = computed(
    () => this.searchResource.value()?.data ?? [],
  );
  readonly hasSearched = computed(() => this.#validQuery() !== null);

  readonly displayedColumns = ['period', 'type', 'name', 'amount'];

  clearSearch(): void {
    this.#searchModel.set({ query: '' });
  }

  selectResult(result: TransactionSearchResult): void {
    this.#dialogRef.close(result);
  }
}
