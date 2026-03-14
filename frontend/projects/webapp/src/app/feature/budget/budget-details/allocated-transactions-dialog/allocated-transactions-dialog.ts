import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import { AppCurrencyPipe, buildConversionTooltip } from '@core/currency';
import { CurrencyConversionBadge } from '@ui/currency-conversion-badge';
import type { BudgetLineConsumption } from '@core/budget';
import { UserSettingsApi } from '@core/user-settings';

export interface AllocatedTransactionsDialogData {
  budgetLine: BudgetLine;
  consumption: BudgetLineConsumption;
  onToggleTransactionCheck?: (id: string) => void;
}

export interface AllocatedTransactionsDialogResult {
  action: 'add' | 'edit' | 'delete';
  transaction?: Transaction;
}

@Component({
  selector: 'pulpe-allocated-transactions-dialog',
  imports: [
    MatDialogModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    AppCurrencyPipe,
    CurrencyConversionBadge,
    DatePipe,
    DecimalPipe,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        'budget.transactionsDialogTitle'
          | transloco: { name: data.budgetLine.name }
      }}
    </h2>

    <mat-dialog-content class="!max-h-[70vh]">
      <div class="flex flex-col gap-4">
        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4 p-4 bg-surface-container rounded-lg">
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">
              {{ 'budget.tablePlanned' | transloco }}
            </div>
            <div
              class="text-title-medium font-semibold ph-no-capture flex items-center justify-center gap-1"
            >
              {{ data.budgetLine.amount | appCurrency: currency() }}
              <pulpe-currency-conversion-badge
                [originalAmount]="data.budgetLine.originalAmount"
                [originalCurrency]="data.budgetLine.originalCurrency"
                [exchangeRate]="data.budgetLine.exchangeRate"
                [tooltipText]="
                  conversionTooltip(
                    data.budgetLine.originalAmount,
                    data.budgetLine.originalCurrency,
                    data.budgetLine.exchangeRate
                  )
                "
              />
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">
              {{ 'budget.consumedLabel' | transloco }}
            </div>
            <div class="text-title-medium font-semibold ph-no-capture">
              {{ data.consumption.consumed | appCurrency: currency() }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">
              {{ 'budget.availableLabel' | transloco }}
            </div>
            <div
              class="text-title-medium font-semibold ph-no-capture"
              [class.text-error]="data.consumption.remaining < 0"
              [class.text-financial-income]="data.consumption.remaining >= 0"
            >
              {{ data.consumption.remaining | appCurrency: currency() }}
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="px-2">
          <mat-progress-bar
            mode="determinate"
            [value]="consumptionPercentage"
            [class.warn-bar]="consumptionPercentage > 100"
          />
          <div
            class="text-label-small text-on-surface-variant text-center mt-1"
          >
            {{ consumptionPercentage | number: '1.0-0'
            }}{{ 'budgetLine.consumed' | transloco }}
          </div>
        </div>

        <!-- Transactions table -->
        @if (data.consumption.allocatedTransactions.length > 0) {
          <table
            mat-table
            [dataSource]="data.consumption.allocatedTransactions"
            class="w-full"
          >
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>
                {{ 'budget.dateColumn' | transloco }}
              </th>
              <td mat-cell *matCellDef="let tx" class="text-body-small">
                {{ tx.transactionDate | date: 'dd.MM.yyyy' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>
                {{ 'budget.tableDescription' | transloco }}
              </th>
              <td mat-cell *matCellDef="let tx" class="text-body-medium">
                {{ tx.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="text-right">
                {{ 'transactionForm.amountLabel' | transloco }}
              </th>
              <td
                mat-cell
                *matCellDef="let tx"
                class="text-right text-body-medium font-medium ph-no-capture"
              >
                <span class="inline-flex items-center gap-1">
                  {{ tx.amount | appCurrency: currency() }}
                  <pulpe-currency-conversion-badge
                    [originalAmount]="tx.originalAmount"
                    [originalCurrency]="tx.originalCurrency"
                    [exchangeRate]="tx.exchangeRate"
                    [tooltipText]="
                      conversionTooltip(
                        tx.originalAmount,
                        tx.originalCurrency,
                        tx.exchangeRate
                      )
                    "
                  />
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="w-28"></th>
              <td mat-cell *matCellDef="let tx" class="text-right">
                <button
                  matIconButton
                  (click)="editTransaction(tx)"
                  [matTooltip]="'common.edit' | transloco"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  matIconButton
                  (click)="deleteTransaction(tx)"
                  [matTooltip]="'common.delete' | transloco"
                  class="text-error"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        } @else {
          <div class="text-center py-8 text-on-surface-variant">
            <mat-icon class="!text-5xl mb-2">receipt_long</mat-icon>
            <p class="text-body-medium">
              {{ 'budget.noTransaction' | transloco }}
            </p>
            <p class="text-body-small">
              {{ 'budget.noTransactionHint' | transloco }}
            </p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="close()">
        {{ 'common.close' | transloco }}
      </button>
      <button matButton="filled" (click)="addTransaction()">
        <mat-icon>add</mat-icon>
        {{ 'budget.newTransactionButton' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    table {
      background: transparent;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllocatedTransactionsDialog {
  readonly #userSettings = inject(UserSettingsApi);
  readonly #transloco = inject(TranslocoService);
  protected readonly currency = this.#userSettings.currency;
  readonly data = inject<AllocatedTransactionsDialogData>(MAT_DIALOG_DATA);
  readonly #dialogRef = inject(
    MatDialogRef<
      AllocatedTransactionsDialog,
      AllocatedTransactionsDialogResult
    >,
  );

  readonly displayedColumns = ['date', 'name', 'amount', 'actions'];

  readonly consumptionPercentage =
    this.data.budgetLine.amount > 0
      ? Math.round(
          (this.data.consumption.consumed / this.data.budgetLine.amount) * 100,
        )
      : 0;

  close(): void {
    this.#dialogRef.close();
  }

  addTransaction(): void {
    this.#dialogRef.close({ action: 'add' });
  }

  editTransaction(transaction: Transaction): void {
    this.#dialogRef.close({ action: 'edit', transaction });
  }

  deleteTransaction(transaction: Transaction): void {
    this.#dialogRef.close({ action: 'delete', transaction });
  }

  protected conversionTooltip(
    originalAmount: number | null | undefined,
    originalCurrency: string | null | undefined,
    exchangeRate: number | null | undefined,
  ): string {
    return buildConversionTooltip(
      this.#transloco,
      originalAmount,
      originalCurrency,
      exchangeRate,
    );
  }
}
