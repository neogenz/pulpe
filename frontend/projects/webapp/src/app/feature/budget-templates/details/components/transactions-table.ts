import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppCurrencyPipe } from '@core/currency';
import { UserSettingsStore } from '@core/user-settings';

export interface FinancialEntry {
  description: string;
  spent: number;
  earned: number;
  saved: number;
  total: number;
}

@Component({
  selector: 'pulpe-transactions-table',

  imports: [MatTableModule, AppCurrencyPipe, TranslocoPipe],
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
              {{ 'template.colDescription' | transloco }}
            </th>
            <td mat-cell *matCellDef="let row" class="px-4 py-2">
              <span class="ph-no-capture">{{ row.description }}</span>
            </td>
          </ng-container>

          <!-- Spent column -->
          <ng-container matColumnDef="spent">
            <th
              mat-header-cell
              *matHeaderCellDef
              class="text-right font-medium px-4 py-3 text-title-medium bg-surface-container-low"
            >
              {{ 'template.colSpent' | transloco }}
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.spent !== 0) {
                <span class="ph-no-capture">{{
                  row.spent | appCurrency: currency()
                }}</span>
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
              {{ 'template.colEarned' | transloco }}
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.earned !== 0) {
                <span class="ph-no-capture">{{
                  row.earned | appCurrency: currency()
                }}</span>
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
              {{ 'template.colSaved' | transloco }}
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              @if (row.saved !== 0) {
                <span class="ph-no-capture">{{
                  row.saved | appCurrency: currency()
                }}</span>
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
              {{ 'template.colTotal' | transloco }}
            </th>
            <td mat-cell *matCellDef="let row" class="text-right px-4 py-2">
              <span class="ph-no-capture">{{
                row.total | appCurrency: currency()
              }}</span>
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
  readonly #userSettings = inject(UserSettingsStore);
  protected readonly currency = this.#userSettings.currency;
  readonly entries = input.required<readonly FinancialEntry[]>();

  readonly displayedColumns = [
    'description',
    'spent',
    'earned',
    'saved',
    'total',
  ] as const;
}
