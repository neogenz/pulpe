import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { Logger } from '@core/logging/logger';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { FinancialKindDirective } from '@ui/financial-kind';
import { RecurrenceLabelPipe } from '@ui/transaction-display';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import { ActionsCell, BalanceCell, NameCell, RemainingCell } from './cells';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import type {
  BudgetLineTableItem,
  GroupHeaderTableItem,
  TableRowItem,
  TransactionTableItem,
} from '../data-core';

/**
 * Table component for displaying budget lines in a mat-table.
 * Handles the table-specific rendering logic.
 */
@Component({
  selector: 'pulpe-budget-table',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatChipsModule,
    MatTooltipModule,
    CurrencyPipe,
    FinancialKindDirective,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
    NameCell,
    ActionsCell,
    RemainingCell,
    BalanceCell,
  ],
  template: `
    <div class="overflow-x-auto">
      <table
        mat-table
        [dataSource]="tableData()"
        [trackBy]="trackByRow"
        class="w-full min-w-[700px]"
      >
        <!-- Name Column -->
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Description</th>
          <td mat-cell *matCellDef="let line">
            <pulpe-name-cell [line]="line" />
          </td>
        </ng-container>

        <!-- Planned Column -->
        <ng-container matColumnDef="planned">
          <th mat-header-cell *matHeaderCellDef class="text-right">Prévu</th>
          <td mat-cell *matCellDef="let line" class="text-right">
            <span
              class="text-body-medium font-bold"
              [class.italic]="line.metadata.isRollover"
              [pulpeFinancialKind]="line.data.kind"
            >
              {{ line.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
            </span>
          </td>
        </ng-container>

        <!-- Spent Column -->
        <ng-container matColumnDef="spent">
          <th mat-header-cell *matHeaderCellDef>Dépensé</th>
          <td mat-cell *matCellDef="let line">
            @if (
              line.metadata.itemType === 'budget_line' &&
              !line.metadata.isRollover &&
              line.consumption?.hasTransactions
            ) {
              <button
                matButton
                class="text-body-small h-8! px-3!"
                [matBadge]="line.consumption.transactionCount"
                matBadgeColor="primary"
                (click)="viewTransactions.emit(line)"
                [matTooltip]="
                  'Voir les ' + line.consumption.transactionCountLabel
                "
              >
                <mat-icon class="text-base! mr-1">receipt_long</mat-icon>
                {{
                  line.consumption.consumed
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </button>
            }
          </td>
        </ng-container>

        <!-- Remaining Column -->
        <ng-container matColumnDef="remaining">
          <th mat-header-cell *matHeaderCellDef class="text-right!">Reste</th>
          <td mat-cell *matCellDef="let line" class="text-right">
            <pulpe-remaining-cell [line]="line" />
          </td>
        </ng-container>

        <!-- Balance Column -->
        <ng-container matColumnDef="balance">
          <th mat-header-cell *matHeaderCellDef class="text-right">Solde</th>
          <td mat-cell *matCellDef="let line" class="text-right">
            <pulpe-balance-cell [line]="line" />
          </td>
        </ng-container>

        <!-- Recurrence Column -->
        <ng-container matColumnDef="recurrence">
          <th mat-header-cell *matHeaderCellDef>Fréquence</th>
          <td mat-cell *matCellDef="let line">
            <mat-chip
              class="bg-secondary-container chip-on-secondary-container"
            >
              @if ('recurrence' in line.data) {
                {{ line.data.recurrence | recurrenceLabel }}
              } @else {
                Une seule fois
              }
            </mat-chip>
          </td>
        </ng-container>

        <!-- Group Header Column -->
        <ng-container matColumnDef="groupHeader">
          <td
            mat-cell
            *matCellDef="let row"
            [attr.colspan]="displayedColumns.length"
            class="!py-3 !px-4"
          >
            <div class="flex items-center gap-2">
              <mat-icon class="text-lg">{{ row.metadata.groupIcon }}</mat-icon>
              <span class="text-title-medium font-semibold">
                {{ row.metadata.groupLabel }}
              </span>
              <span class="text-label-small text-on-surface-variant">
                ({{ row.metadata.itemCount }})
              </span>
            </div>
          </td>
        </ng-container>

        <!-- Actions Column -->
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let line">
            <pulpe-actions-cell
              [line]="line"
              (edit)="startEdit($event)"
              (delete)="delete.emit($event)"
              (addTransaction)="addTransaction.emit($event)"
              (resetFromTemplate)="onResetFromTemplateClick($event)"
              (toggleCheck)="toggleCheck.emit($event)"
              (toggleTransactionCheck)="toggleTransactionCheck.emit($event)"
            />
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: ['groupHeader']; when: isGroupHeader"
          class="group-header-row"
        ></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: displayedColumns"
          class="hover:bg-surface-container-low transition-opacity"
          [class.opacity-50]="row.metadata?.isLoading"
          [class.pointer-events-none]="row.metadata?.isLoading"
          [class.line-through]="row.data?.checkedAt"
          [class.bg-surface-container-lowest]="
            row.metadata?.isNestedUnderEnvelope
          "
          [attr.data-testid]="
            'budget-line-' + (row.data?.name | rolloverFormat)
          "
        ></tr>

        <!-- No data row -->
        <tr class="mat-row" *matNoDataRow>
          <td
            class="mat-cell text-center py-8"
            [attr.colspan]="displayedColumns.length"
          >
            <p class="text-body-medium text-on-surface-variant">
              Aucune prévision définie
            </p>
            <button
              matButton="outlined"
              (click)="add.emit()"
              class="mt-4"
              data-testid="add-first-line-table"
            >
              <mat-icon>add</mat-icon>
              Commencer à planifier
            </button>
          </td>
        </tr>
      </table>
    </div>
  `,
  styles: `
    @reference "tailwindcss";
    :host {
      display: block;
    }

    table {
      background: transparent;
    }

    .mat-mdc-row {
      transition: background-color 150ms ease-out;
    }

    .mat-mdc-row:hover {
      background-color: var(--mat-sys-surface-container-lowest);
    }

    .mat-mdc-row:not(.group-header-row) {
      height: 64px;
    }

    .chip-on-secondary-container {
      --mat-chip-label-text-color: var(--mat-sys-on-secondary-container);
    }

    .group-header-row {
      background-color: var(--mat-sys-surface-container);
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .group-header-row:first-of-type {
      border-top: none;
    }

    tr.line-through {
      opacity: 0.7;
    }

    tr.line-through:hover {
      opacity: 0.85;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTable {
  readonly #dialog = inject(MatDialog);
  readonly #logger = inject(Logger);

  // Inputs
  readonly tableData = input.required<TableRowItem[]>();

  // Outputs
  readonly update = output<BudgetLineUpdate>();
  readonly delete = output<string>();
  readonly add = output<void>();
  readonly addTransaction = output<BudgetLine>();
  readonly viewTransactions = output<BudgetLineTableItem>();
  readonly resetFromTemplate = output<string>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  // Desktop columns
  readonly displayedColumns = [
    'name',
    'planned',
    'spent',
    'remaining',
    'balance',
    'recurrence',
    'actions',
  ];

  readonly trackByRow = (_: number, row: TableRowItem): string => {
    if (row.metadata.itemType === 'group_header') {
      return `group-${row.metadata.groupKind}`;
    }
    return (row as BudgetLineTableItem | TransactionTableItem).data.id;
  };

  readonly isGroupHeader = (
    _index: number,
    row: TableRowItem,
  ): row is GroupHeaderTableItem => row.metadata.itemType === 'group_header';

  startEdit(item: BudgetLineTableItem): void {
    this.#openEditDialog(item);
  }

  async #openEditDialog(item: BudgetLineTableItem): Promise<void> {
    try {
      const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
        data: { budgetLine: item.data },
        width: '400px',
        maxWidth: '90vw',
      });

      const result = await firstValueFrom(dialogRef.afterClosed());
      if (result) this.update.emit(result);
    } catch (error) {
      this.#logger.error('Failed to open edit dialog', {
        error,
        itemId: item.data.id,
      });
    }
  }

  async onResetFromTemplateClick(line: BudgetLineTableItem): Promise<void> {
    try {
      const dialogRef = this.#dialog.open(ConfirmationDialog, {
        data: {
          title: 'Réinitialiser depuis le modèle',
          message:
            'Cette action va remplacer les valeurs actuelles par celles du modèle. Cette action est irréversible.',
          confirmText: 'Réinitialiser',
          confirmColor: 'primary',
        } satisfies ConfirmationDialogData,
        width: '400px',
      });

      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (confirmed) {
        this.resetFromTemplate.emit(line.data.id);
      }
    } catch (error) {
      this.#logger.error('Failed to open reset confirmation dialog', {
        error,
        lineId: line.data.id,
      });
    }
  }
}
