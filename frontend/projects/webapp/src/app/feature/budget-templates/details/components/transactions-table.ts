import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
 */
@Component({
  selector: 'pulpe-transactions-table',
  standalone: true,
  imports: [MatTableModule],
  template: `
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
          class="text-left font-medium px-4 py-2"
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
          class="text-right font-medium px-4 py-2"
        >
          Dépensé
        </th>
        <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
          @if (row.spent !== 0) {
            {{ row.spent }}
          }
        </td>
      </ng-container>

      <!-- Earned column -->
      <ng-container matColumnDef="earned">
        <th
          mat-header-cell
          *matHeaderCellDef
          class="text-right font-medium px-4 py-2"
        >
          Gagné
        </th>
        <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
          @if (row.earned !== 0) {
            {{ row.earned }}
          }
        </td>
      </ng-container>

      <!-- Saved column -->
      <ng-container matColumnDef="saved">
        <th
          mat-header-cell
          *matHeaderCellDef
          class="text-right font-medium px-4 py-2"
        >
          Économisé
        </th>
        <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
          @if (row.saved !== 0) {
            {{ row.saved }}
          }
        </td>
      </ng-container>

      <!-- Total column -->
      <ng-container matColumnDef="total">
        <th
          mat-header-cell
          *matHeaderCellDef
          class="text-right font-medium px-4 py-2"
        >
          Total
        </th>
        <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
          {{ row.total }}
        </td>
      </ng-container>

      <!-- Header & data rows -->
      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr
        mat-row
        *matRowDef="let row; columns: displayedColumns; let isOdd = odd"
        [class.odd-row]="isOdd"
      ></tr>
    </table>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow: auto;
    }

    .odd-row {
      background-color: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
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
