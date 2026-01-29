import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { BudgetLine, Transaction } from 'pulpe-shared';
import type { BudgetLineConsumption } from '@core/budget';

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
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      Transactions - {{ data.budgetLine.name }}
    </h2>

    <mat-dialog-content class="!max-h-[70vh]">
      <div class="flex flex-col gap-4">
        <!-- Summary -->
        <div class="grid grid-cols-3 gap-4 p-4 bg-surface-container rounded-lg">
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">Prévu</div>
            <div class="text-title-medium font-semibold">
              {{
                data.budgetLine.amount | currency: 'CHF' : 'symbol' : '1.2-2'
              }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">Consommé</div>
            <div class="text-title-medium font-semibold">
              {{
                data.consumption.consumed | currency: 'CHF' : 'symbol' : '1.2-2'
              }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-label-small text-on-surface-variant">
              Disponible
            </div>
            <div
              class="text-title-medium font-semibold"
              [class.text-error]="data.consumption.remaining < 0"
              [class.text-financial-income]="data.consumption.remaining >= 0"
            >
              {{
                data.consumption.remaining
                  | currency: 'CHF' : 'symbol' : '1.2-2'
              }}
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
            {{ consumptionPercentage | number: '1.0-0' }}% utilisé
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
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let tx" class="text-body-small">
                {{ tx.transactionDate | date: 'dd.MM.yyyy' : 'fr-CH' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Description</th>
              <td mat-cell *matCellDef="let tx" class="text-body-medium">
                {{ tx.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="text-right">
                Montant
              </th>
              <td
                mat-cell
                *matCellDef="let tx"
                class="text-right text-body-medium font-medium"
              >
                {{ tx.amount | currency: 'CHF' : 'symbol' : '1.2-2' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="w-20"></th>
              <td mat-cell *matCellDef="let tx" class="text-right">
                <button
                  matIconButton
                  (click)="deleteTransaction(tx)"
                  matTooltip="Supprimer"
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
            <p class="text-body-medium">Aucune transaction enregistrée</p>
            <p class="text-body-small">
              Ajoutez des transactions pour suivre vos dépenses réelles
            </p>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="close()">Fermer</button>
      <button matButton="filled" (click)="addTransaction()">
        <mat-icon>add</mat-icon>
        Nouvelle transaction
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

  deleteTransaction(transaction: Transaction): void {
    this.#dialogRef.close({ action: 'delete', transaction });
  }
}
