import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import { Logger } from '@core/logging/logger';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { FinancialKindDirective } from '@ui/financial-kind';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import type {
  BudgetLineTableItem,
  GroupHeaderTableItem,
  TableRowItem,
  TransactionTableItem,
} from '../data-core';

/**
 * Table view component for displaying budget lines in a mat-table.
 * This component only handles the table-specific rendering logic.
 */
@Component({
  selector: 'pulpe-budget-table-view',
  imports: [
    MatTableModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule,
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    FinancialKindDirective,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
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
            @if (line.metadata.isEditing) {
              <form [formGroup]="editForm" (ngSubmit)="saveEdit()" class="py-2">
                <mat-form-field
                  appearance="outline"
                  class="w-full"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    formControlName="name"
                    placeholder="Nom de la ligne"
                    [attr.data-testid]="'edit-name-' + line.data.id"
                    class="text-body-medium"
                    (keydown.enter)="saveEdit()"
                    (keydown.escape)="cancelEdit()"
                  />
                </mat-form-field>
              </form>
            } @else {
              <div class="flex items-center gap-2">
                @if (line.metadata.isNestedUnderEnvelope) {
                  <mat-icon class="text-sm! text-outline shrink-0">
                    subdirectory_arrow_right
                  </mat-icon>
                } @else {
                  <mat-icon
                    class="text-base! shrink-0"
                    [pulpeFinancialKind]="line.data.kind"
                    [matTooltip]="line.data.kind | transactionLabel"
                    matTooltipPosition="above"
                  >
                    {{ line.metadata.kindIcon }}
                  </mat-icon>
                }
                <span
                  class="inline-flex items-center gap-2"
                  [class.rollover-text]="line.metadata.isRollover"
                >
                  @if (
                    line.metadata.isRollover &&
                    line.metadata.rolloverSourceBudgetId
                  ) {
                    <a
                      [routerLink]="[
                        '/app/budget',
                        line.metadata.rolloverSourceBudgetId,
                      ]"
                      matButton
                      class="ph-no-capture text-body-medium font-semibold"
                    >
                      <mat-icon class="text-base!">open_in_new</mat-icon>
                      {{ line.data.name | rolloverFormat }}
                    </a>
                  } @else {
                    <div class="flex flex-col">
                      <span
                        class="ph-no-capture text-body-medium font-semibold flex items-center gap-1"
                        [pulpeFinancialKind]="line.data.kind"
                      >
                        {{ line.data.name | rolloverFormat }}
                        @if (line.metadata.isPropagationLocked) {
                          <mat-icon
                            class="text-base! text-outline"
                            matTooltip="Montants verrouillés = non affectés par la propagation"
                            matTooltipPosition="above"
                          >
                            lock
                          </mat-icon>
                        }
                      </span>
                      @if (line.metadata.envelopeName) {
                        <span
                          class="flex items-center gap-1 text-label-small text-on-surface-variant"
                        >
                          <mat-icon class="text-sm!">folder</mat-icon>
                          {{ line.metadata.envelopeName }}
                        </span>
                      }
                    </div>
                  }
                  @if (line.data.checkedAt) {
                    <span class="text-body-small text-on-surface-variant ml-2">
                      {{ line.data.checkedAt | date: 'dd.MM' : '' : 'fr-CH' }}
                    </span>
                  }
                </span>
              </div>
            }
          </td>
        </ng-container>

        <!-- Planned Column -->
        <ng-container matColumnDef="planned">
          <th mat-header-cell *matHeaderCellDef class="text-right">Prévu</th>
          <td mat-cell *matCellDef="let line" class="text-right">
            @if (line.metadata.isEditing) {
              <form
                [formGroup]="editForm"
                (ngSubmit)="saveEdit()"
                class="py-2 flex justify-end"
              >
                <mat-form-field
                  appearance="outline"
                  class="w-28"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    type="number"
                    formControlName="amount"
                    placeholder="0.00"
                    step="1"
                    min="0"
                    [attr.data-testid]="'edit-amount-' + line.data.id"
                    class="text-body-medium text-right"
                    (keydown.enter)="saveEdit()"
                    (keydown.escape)="cancelEdit()"
                  />
                  <span matTextSuffix>CHF</span>
                </mat-form-field>
              </form>
            } @else {
              <span
                class="text-body-medium font-bold"
                [class.italic]="line.metadata.isRollover"
                [pulpeFinancialKind]="line.data.kind"
              >
                {{ line.data.amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
              </span>
            }
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
            @if (line.consumption?.hasTransactions) {
              @let remaining = line.data.amount - line.consumption.consumed;
              @let isExceeded = remaining < 0;

              <div class="flex flex-col items-end gap-1">
                <div class="flex flex-col items-center">
                  <span
                    class="text-body-medium font-semibold"
                    [class.text-error]="isExceeded"
                  >
                    {{ remaining | currency: 'CHF' : 'symbol' : '1.0-0' }}
                    @if (isExceeded) {
                      <span class="text-label-small font-normal ml-1"
                        >dépassé</span
                      >
                    }
                  </span>
                  @if (!line.metadata.isRollover) {
                    <mat-progress-bar
                      mode="determinate"
                      [value]="
                        line.consumption.percentage > 100
                          ? 100
                          : line.consumption.percentage
                      "
                      [class.warn-bar]="line.consumption.percentage > 100"
                      class="h-1.5! w-24! rounded-full"
                    />
                  }
                </div>
              </div>
            }
          </td>
        </ng-container>

        <!-- Balance Column -->
        <ng-container matColumnDef="balance">
          <th mat-header-cell *matHeaderCellDef class="text-right">Solde</th>
          <td mat-cell *matCellDef="let line" class="text-right">
            <div class="inline-flex items-center gap-1">
              <mat-icon
                class="text-sm! w-4! h-4!"
                [class.text-financial-income]="line.data.kind === 'income'"
                [class.text-financial-negative]="
                  line.data.kind === 'expense' || line.data.kind === 'saving'
                "
              >
                @if (line.data.kind === 'income') {
                  trending_up
                } @else {
                  trending_down
                }
              </mat-icon>
              <span
                class="text-body-medium font-medium"
                [class.text-financial-income]="
                  line.metadata.cumulativeBalance >= 0
                "
                [class.text-financial-negative]="
                  line.metadata.cumulativeBalance < 0
                "
              >
                {{
                  line.metadata.cumulativeBalance
                    | currency: 'CHF' : 'symbol' : '1.0-0'
                }}
              </span>
            </div>
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
            <div class="flex gap-1 justify-end items-center">
              @if (line.metadata.isEditing) {
                <div class="flex items-center gap-2">
                  <button
                    matButton
                    (click)="cancelEdit()"
                    [attr.data-testid]="'cancel-' + line.data.id"
                    class="density-3"
                  >
                    <mat-icon class="text-base! mr-1">close</mat-icon>
                    Annuler
                  </button>
                  <button
                    matButton="filled"
                    (click)="saveEdit()"
                    [attr.data-testid]="'save-' + line.data.id"
                    [disabled]="!editForm.valid"
                    class="density-3"
                  >
                    <mat-icon class="text-base! mr-1">check</mat-icon>
                    Enregistrer
                  </button>
                </div>
              } @else {
                @if (line.metadata.itemType === 'budget_line') {
                  <mat-slide-toggle
                    [checked]="!!line.data.checkedAt"
                    (change)="toggleCheck.emit(line.data.id)"
                    (click)="$event.stopPropagation()"
                    [attr.data-testid]="'toggle-check-' + line.data.id"
                  />
                } @else if (line.metadata.itemType === 'transaction') {
                  <mat-slide-toggle
                    [checked]="!!line.data.checkedAt"
                    (change)="toggleTransactionCheck.emit(line.data.id)"
                    (click)="$event.stopPropagation()"
                    [attr.data-testid]="'toggle-check-tx-' + line.data.id"
                  />
                }
                @if (!line.metadata.isRollover) {
                  <button
                    matIconButton
                    [matMenuTriggerFor]="rowActionMenu"
                    [attr.data-testid]="'actions-menu-' + line.data.id"
                    [disabled]="line.metadata.isLoading"
                  >
                    <mat-icon>more_vert</mat-icon>
                  </button>

                  <mat-menu #rowActionMenu="matMenu" xPosition="before">
                    <div
                      class="px-4 py-2 text-label-medium text-on-surface-variant max-w-48 truncate"
                      [matTooltip]="line.data.name"
                      matTooltipShowDelay="500"
                    >
                      {{ line.data.name }}
                    </div>
                    <mat-divider />
                    @if (line.metadata.itemType === 'budget_line') {
                      <button
                        mat-menu-item
                        (click)="addTransaction.emit(line.data)"
                        [attr.data-testid]="'add-transaction-' + line.data.id"
                      >
                        <mat-icon matMenuItemIcon>add</mat-icon>
                        <span>{{ line.metadata.allocationLabel }}</span>
                      </button>
                      <button
                        mat-menu-item
                        (click)="startEdit(line)"
                        [attr.data-testid]="'edit-' + line.data.id"
                      >
                        <mat-icon matMenuItemIcon>edit</mat-icon>
                        <span>Éditer</span>
                      </button>
                    }
                    @if (line.metadata.canResetFromTemplate) {
                      <button
                        mat-menu-item
                        (click)="onResetFromTemplateClick(line)"
                        [attr.data-testid]="
                          'reset-from-template-' + line.data.id
                        "
                      >
                        <mat-icon matMenuItemIcon>refresh</mat-icon>
                        <span>Réinitialiser</span>
                      </button>
                    }
                    <button
                      mat-menu-item
                      (click)="delete.emit(line.data.id)"
                      [attr.data-testid]="'delete-' + line.data.id"
                      class="text-error"
                    >
                      <mat-icon matMenuItemIcon class="text-error"
                        >delete</mat-icon
                      >
                      <span>Supprimer</span>
                    </button>
                  </mat-menu>
                }
              }
            </div>
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

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
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
export class BudgetTableView {
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
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
  displayedColumns = [
    'name',
    'planned',
    'spent',
    'remaining',
    'balance',
    'recurrence',
    'actions',
  ];

  // Inline edit state
  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

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

  #openEditDialog(item: BudgetLineTableItem): void {
    try {
      const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
        data: { budgetLine: item.data },
        width: '400px',
        maxWidth: '90vw',
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe((result: BudgetLineUpdate | undefined) => {
          if (result) this.update.emit(result);
        });
    } catch (error) {
      this.#logger.error('Failed to open edit dialog', {
        error,
        itemId: item.data.id,
      });
    }
  }

  cancelEdit(): void {
    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
  }

  saveEdit(): void {
    const editingId = this.inlineFormEditingItem()?.data.id;
    if (!editingId || !this.editForm.valid) return;

    const value = this.editForm.getRawValue();
    const name = value.name?.trim();
    const amount = value.amount;
    if (!name || amount == null) return;

    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
    this.update.emit({
      id: editingId,
      name,
      amount,
      isManuallyAdjusted: true,
    });
  }

  onResetFromTemplateClick(line: BudgetLineTableItem): void {
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

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.resetFromTemplate.emit(line.data.id);
        }
      });
  }
}
