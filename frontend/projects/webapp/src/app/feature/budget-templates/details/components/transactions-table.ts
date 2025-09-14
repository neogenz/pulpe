import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';

/**
 * One immutable row displayed in the financial entries table.
 */
export interface FinancialEntry {
  description: string;
  /** Amount already spent – must be positive CHF value in centimes */
  spent: number;
  /** Amount earned – must be positive CHF value in centimes */
  earned: number;
  /** Amount saved – must be positive CHF value in centimes */
  saved: number;
  /** Net total for the row in centimes */
  total: number;
}

/**
 * Generic, presentation-only table component for displaying financial entries.
 *
 * – Pure UI component (no business logic, no service injection).
 * – Relies on Angular Material Table for accessibility & MD3 compliance.
 * – Tailwind utility classes are applied for spacing and responsive layout.
 * – Features sticky header and full-height scrollable content.
 */
@Component({
  selector: 'pulpe-transactions-table',

  imports: [MatTableModule, CurrencyPipe],
  template: `
    <div
      class="flex flex-col rounded-corner-large overflow-hidden bg-surface-container-low max-h-[50vh] 2xl:h-full 2xl:max-h-none"
    >
      <div class="flex-1 overflow-y-auto">
        <table
          mat-table
          [dataSource]="entries()"
          class="w-full border-collapse text-body-medium"
        >
          <!-- Description column -->
          <ng-container matColumnDef="description">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-left font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              Description
            </th>
            <td mat-cell *matCellDef="let row" class="px-4 py-2">
              {{ row.description }}
            </td>
          </ng-container>

          <!-- Spent column -->
          <ng-container matColumnDef="spent">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-right font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              Dépensé
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.spent !== 0) {
                {{ row.spent | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH' }}
              }
            </td>
          </ng-container>

          <!-- Earned column -->
          <ng-container matColumnDef="earned">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-right font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              Gagné
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.earned !== 0) {
                {{
                  row.earned | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                }}
              }
            </td>
          </ng-container>

          <!-- Saved column -->
          <ng-container matColumnDef="saved">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-right font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              Économisé
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.saved !== 0) {
                {{ row.saved | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH' }}
              }
            </td>
          </ng-container>

          <!-- Total column -->
          <ng-container matColumnDef="total">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-right font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              Total
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              {{ row.total | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH' }}
            </td>
          </ng-container>

          <!-- Header & data rows with sticky header -->
          <tr
            mat-header-row
            *matHeaderRowDef="displayedColumns; sticky: true"
          ></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns; let isOdd = odd"
            [class.odd-row]="isOdd"
          ></tr>
        </table>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .odd-row {
      background-color: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
    }

    /* Ensure sticky header stays on top during scroll */
    .mat-mdc-header-row {
      position: sticky;
      top: 0;
      z-index: 1;
      background-color: var(--mat-sys-surface-container-low);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsTable {
  /** Immutable list of entries to display. */
  entries = input.required<readonly FinancialEntry[]>();

  // Material table determines column order via this array.
  readonly displayedColumns = [
    'description',
    'spent',
    'earned',
    'saved',
    'total',
  ] as const;
}
