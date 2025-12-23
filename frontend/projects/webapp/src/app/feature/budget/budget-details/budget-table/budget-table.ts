import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { RolloverFormatPipe } from '@app/ui/rollover-format';
import {
  calculateAllConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { Logger } from '@core/logging/logger';
import { type BudgetLine, type BudgetLineUpdate } from '@pulpe/shared';
import {
  RecurrenceLabelPipe,
  TransactionLabelPipe,
} from '@ui/transaction-display';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import {
  type BudgetLineTableItem,
  type TableItem,
} from './budget-table-models';

@Component({
  selector: 'pulpe-budget-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    ReactiveFormsModule,
    RouterLink,
    CurrencyPipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
  ],
  host: {},
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Éléments du budget</mat-card-title>
        <mat-card-subtitle>
          Prévisions et transactions réelles
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="overflow-x-auto">
        <table
          mat-table
          [dataSource]="budgetTableData()"
          [trackBy]="trackByRow"
          class="w-full min-w-[600px]"
        >
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let line">
              @if (line.metadata.isEditing) {
                <form
                  [formGroup]="editForm"
                  (ngSubmit)="saveEdit()"
                  class="py-2"
                >
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
                  <span
                    class="inline-flex items-center gap-2 cursor-help"
                    [class.rollover-text]="line.metadata.isRollover"
                    [matTooltip]="line.data.kind | transactionLabel"
                    matTooltipPosition="above"
                    [attr.aria-describedby]="'type-tooltip-' + line.data.id"
                    [attr.aria-label]="
                      'Type de transaction: ' +
                      (line.data.kind | transactionLabel)
                    "
                    tabindex="0"
                  >
                    @if (
                      line.metadata.isRollover &&
                      line.data.rolloverSourceBudgetId
                    ) {
                      <a
                        [routerLink]="[
                          '/app/budget',
                          line.data.rolloverSourceBudgetId,
                        ]"
                        matButton
                        class="ph-no-capture text-body-medium font-semibold"
                      >
                        <mat-icon class="!text-base">open_in_new</mat-icon>
                        {{ line.data.name | rolloverFormat }}
                      </a>
                    } @else {
                      <span
                        class="ph-no-capture text-body-medium font-semibold flex items-center gap-1"
                      >
                        {{ line.data.name | rolloverFormat }}
                        @if (line.metadata.isPropagationLocked) {
                          <mat-icon
                            class="!text-base text-outline"
                            [matTooltip]="
                              'Montants verrouillés = non affectés par la propagation'
                            "
                            matTooltipPosition="above"
                          >
                            lock
                          </mat-icon>
                        }
                      </span>
                    }
                  </span>
                </div>
              }
            </td>
          </ng-container>

          <!-- Recurrence Column -->
          <ng-container matColumnDef="recurrence">
            <th mat-header-cell *matHeaderCellDef>Fréquence</th>
            <td mat-cell *matCellDef="let line">
              @if ('recurrence' in line.data) {
                <mat-chip
                  [class.bg-primary-container!]="
                    line.data.recurrence === 'fixed'
                  "
                  [class.text-on-primary-container!]="
                    line.data.recurrence === 'fixed'
                  "
                  [class.bg-secondary-container!]="
                    line.data.recurrence === 'one_off'
                  "
                  [class.text-on-secondary-container!]="
                    line.data.recurrence === 'one_off'
                  "
                >
                  {{ line.data.recurrence | recurrenceLabel }}
                </mat-chip>
              } @else {
                <mat-chip
                  class="bg-secondary-container text-on-secondary-container"
                >
                  Une seule fois
                </mat-chip>
              }
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Montant
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              @if (line.metadata.isEditing) {
                <form
                  [formGroup]="editForm"
                  (ngSubmit)="saveEdit()"
                  class="py-2 flex justify-end"
                >
                  <mat-form-field
                    appearance="outline"
                    class="w-28 md:w-36"
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
                  class="ph-no-capture text-body-medium font-medium"
                  [class.text-financial-income]="line.data.kind === 'income'"
                  [class.text-financial-expense]="line.data.kind === 'expense'"
                  [class.text-primary]="line.data.kind === 'saving'"
                  [class.italic]="line.metadata.isRollover"
                >
                  {{ line.data.amount | currency: 'CHF' }}
                </span>
              }
            </td>
          </ng-container>

          <!-- Consumption Column (only for budget lines) -->
          <ng-container matColumnDef="consumption">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Consommé
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              @if (
                line.metadata.itemType === 'budget_line' &&
                !line.metadata.isRollover
              ) {
                @let consumption = budgetLineConsumptions().get(line.data.id);
                @if (consumption && consumption.transactionCount > 0) {
                  <button
                    matButton
                    class="text-body-small !h-8 !px-2"
                    (click)="openAllocatedTransactions(line.data, consumption)"
                    [matTooltip]="
                      'Voir les ' +
                      consumption.transactionCount +
                      ' transaction(s)'
                    "
                  >
                    <mat-icon class="!text-base mr-1">receipt_long</mat-icon>
                    <span
                      [class.text-error]="consumption.remaining < 0"
                      [class.font-bold]="consumption.remaining < 0"
                    >
                      {{
                        consumption.consumed
                          | currency: 'CHF' : 'symbol' : '1.0-0'
                      }}
                    </span>
                  </button>
                } @else {
                  <button
                    matButton="outlined"
                    class="text-body-small !h-8 !px-2"
                    (click)="addAllocatedTransaction(line.data)"
                    matTooltip="Ajouter une transaction"
                  >
                    <mat-icon class="!text-base">add</mat-icon>
                  </button>
                }
              }
            </td>
          </ng-container>

          <!-- Remaining Balance Column -->
          <ng-container matColumnDef="remaining">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Solde restant
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              <span
                class="ph-no-capture text-body-medium font-medium"
                [class.text-financial-income]="
                  line.metadata.cumulativeBalance >= 0
                "
                [class.text-financial-expense]="
                  line.metadata.cumulativeBalance < 0
                "
              >
                {{
                  line.metadata.cumulativeBalance
                    | currency: 'CHF' : 'symbol' : '1.2-2' : 'de-CH'
                }}
              </span>
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
                      [attr.aria-label]="'Cancel editing ' + line.data.name"
                      [attr.data-testid]="'cancel-' + line.data.id"
                      class="density-3"
                    >
                      <mat-icon class="!text-base mr-1">close</mat-icon>
                      Annuler
                    </button>
                    <button
                      matButton="filled"
                      (click)="saveEdit()"
                      [attr.aria-label]="'Save ' + line.data.name"
                      [attr.data-testid]="'save-' + line.data.id"
                      [disabled]="!editForm.valid"
                      class="density-3"
                    >
                      <mat-icon class="!text-base mr-1">check</mat-icon>
                      Enregistrer
                    </button>
                  </div>
                } @else {
                  @if (isMobile() && !line.metadata.isRollover) {
                    <!-- Mobile: Menu button for edit/delete actions -->
                    <button
                      matIconButton
                      [matMenuTriggerFor]="lineActionMenu"
                      [attr.aria-label]="
                        'Actions pour ' + (line.data.name | rolloverFormat)
                      "
                      [attr.data-testid]="'actions-menu-' + line.data.id"
                      [disabled]="line.metadata.isLoading"
                      class="!w-10 !h-10 text-on-surface-variant"
                      (click)="$event.stopPropagation()"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>

                    <mat-menu #lineActionMenu="matMenu" xPosition="before">
                      @if (line.metadata.itemType === 'budget_line') {
                        <button
                          mat-menu-item
                          (click)="addAllocatedTransaction(line.data)"
                          [attr.data-testid]="'allocate-' + line.data.id"
                        >
                          <mat-icon matMenuItemIcon>add_card</mat-icon>
                          <span>Ajouter transaction</span>
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
                  } @else if (!line.metadata.isRollover) {
                    <!-- Desktop: Separate edit and delete buttons -->
                    @if (line.metadata.itemType === 'budget_line') {
                      <button
                        matIconButton
                        (click)="startEdit(line)"
                        [attr.aria-label]="
                          'Edit ' + (line.data.name | rolloverFormat)
                        "
                        [attr.data-testid]="'edit-' + line.data.id"
                        [disabled]="line.metadata.isLoading"
                        class="!w-10 !h-10"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                    }
                    <button
                      matIconButton
                      (click)="delete.emit(line.data.id)"
                      [attr.aria-label]="'Delete ' + line.data.name"
                      [attr.data-testid]="'delete-' + line.data.id"
                      [disabled]="line.metadata.isLoading"
                      class="!w-10 !h-10 text-error"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                }
              </div>
            </td>
          </ng-container>

          <tr
            mat-header-row
            *matHeaderRowDef="currentColumns(); sticky: true"
          ></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: currentColumns()"
            class="hover:bg-surface-container-low transition-opacity"
            [class.opacity-50]="row.metadata.isLoading"
            [class.pointer-events-none]="row.metadata.isLoading"
            [attr.data-testid]="
              'budget-line-' + (row.data.name | rolloverFormat)
            "
          ></tr>

          <!-- No data row -->
          <tr class="mat-row" *matNoDataRow>
            <td
              class="mat-cell text-center py-8"
              [attr.colspan]="currentColumns().length"
            >
              <p class="text-body-medium text-on-surface-variant">
                Aucune prévision définie
              </p>
              <button
                matButton="outlined"
                (click)="add.emit()"
                class="mt-4"
                data-testid="add-first-line"
              >
                <mat-icon>add</mat-icon>
                Commencer à planifier
              </button>
            </td>
          </tr>
        </table>
      </mat-card-content>
      @if (budgetTableData().length > 0) {
        <mat-card-actions class="flex justify-center mb-2">
          <button
            matButton="outlined"
            (click)="add.emit()"
            data-testid="add-budget-line"
          >
            <mat-icon>add</mat-icon>
            Ajouter une prévision
          </button>
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: `
    @reference "tailwindcss";
    :host {
      display: block;
    }

    table {
      background: transparent;
    }

    .mat-mdc-row:hover {
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetTable {
  // Signal inputs - modern Angular 20+ pattern
  budgetLines = input.required<BudgetLineViewModel[]>();
  transactions = input.required<TransactionViewModel[]>();

  update = output<BudgetLineUpdate>();
  delete = output<string>();
  add = output<void>();
  viewAllocatedTransactions = output<{
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }>();
  createAllocatedTransaction = output<BudgetLine>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableDataProvider = inject(BudgetTableDataProvider);
  readonly #logger = inject(Logger);

  // UI configuration - added 'consumption' column
  displayedColumns = [
    'name',
    'amount',
    'consumption',
    'remaining',
    'recurrence',
    'actions',
  ];
  displayedColumnsMobile = ['name', 'amount', 'remaining', 'actions'];

  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  currentColumns = computed(() =>
    this.isMobile() ? this.displayedColumnsMobile : this.displayedColumns,
  );

  // Computed for budget line consumptions
  readonly budgetLineConsumptions = computed(() => {
    const lines = this.budgetLines();
    const txs = this.transactions();
    return calculateAllConsumptions(lines, txs);
  });

  // View Model - single computed that delegates to service
  budgetTableData = computed(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    const editingLine = this.inlineFormEditingItem();

    // Component is now logic-free - just passes data to service
    return this.#budgetTableDataProvider.provideTableData({
      budgetLines,
      transactions,
      editingLineId: editingLine?.data.id ?? null,
    });
  });

  // Track function for performance optimization
  readonly trackByRow = (_: number, row: TableItem): string => row.data.id;

  startEdit(item: BudgetLineTableItem): void {
    // On mobile, open dialog for editing
    if (this.isMobile()) {
      try {
        const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
          data: { budgetLine: item.data },
          width: '400px',
          maxWidth: '90vw',
        });

        dialogRef
          .afterClosed()
          .pipe(takeUntilDestroyed(this.#destroyRef))
          .subscribe((update: BudgetLineUpdate | undefined) => {
            if (update) this.update.emit(update);
          });
      } catch (error) {
        this.#logger.error('Failed to open edit dialog', {
          error,
          itemId: item.data.id,
        });
      }
    } else {
      // Desktop: inline editing
      try {
        this.inlineFormEditingItem.set(item);
        this.editForm.patchValue({
          name: item.data.name,
          amount: item.data.amount,
        });
      } catch (error) {
        this.#logger.error('Failed to start inline edit', {
          error,
          itemId: item.data.id,
        });
      }
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
    const updateData = {
      id: editingId,
      name: value.name!.trim(),
      amount: value.amount!,
      isManuallyAdjusted: true,
    };
    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
    this.update.emit(updateData);
  }

  openAllocatedTransactions(
    budgetLine: BudgetLine,
    consumption: BudgetLineConsumption,
  ): void {
    this.viewAllocatedTransactions.emit({ budgetLine, consumption });
  }

  addAllocatedTransaction(budgetLine: BudgetLine): void {
    this.createAllocatedTransaction.emit(budgetLine);
  }
}
