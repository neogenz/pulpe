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
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  calculateAllEnrichedConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { Logger } from '@core/logging/logger';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { TransactionLabelPipe } from '@ui/transaction-display';
import { map } from 'rxjs/operators';
import { EditBudgetLineDialog } from '../edit-budget-line/edit-budget-line-dialog';
import { type BudgetLineViewModel } from '../models/budget-line-view-model';
import { type TransactionViewModel } from '../models/transaction-view-model';
import { BudgetEnvelopeCard } from './budget-envelope-card';
import {
  BudgetEnvelopeDetailPanel,
  type BudgetEnvelopeDetailDialogData,
} from './budget-envelope-detail-panel';
import { BudgetSectionGroup } from './budget-section-group';
import { BudgetTableDataProvider } from './budget-table-data-provider';
import { BudgetTableMobileCard } from './budget-table-mobile-card';
import {
  type BudgetLineTableItem,
  type GroupHeaderTableItem,
  type TableRowItem,
  type TransactionTableItem,
} from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';
import { BudgetTableViewToggle } from './budget-table-view-toggle';

@Component({
  selector: 'pulpe-budget-table',
  imports: [
    MatTableModule,
    MatCardModule,
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
    CurrencyPipe,
    TransactionLabelPipe,
    BudgetTableViewToggle,
    BudgetTableMobileCard,
    BudgetEnvelopeCard,
    BudgetSectionGroup,
  ],
  template: `
    <mat-card appearance="outlined" class="overflow-hidden">
      <mat-card-header class="bg-surface-container/50 !py-4 !px-5">
        <div class="flex items-center justify-between w-full">
          <div>
            <mat-card-title class="text-title-large"
              >Tes enveloppes</mat-card-title
            >
            <mat-card-subtitle class="text-body-medium text-on-surface-variant">
              {{ budgetLines().length }} prévisions ce mois
            </mat-card-subtitle>
          </div>
          <pulpe-budget-table-view-toggle [(viewMode)]="viewMode" />
        </div>
      </mat-card-header>
      <mat-card-content class="!pt-4">
        @if (isMobile()) {
          <!-- Mobile view -->
          <div class="flex flex-col gap-3">
            @for (item of budgetLineItems(); track item.data.id) {
              <pulpe-budget-table-mobile-card
                [item]="item"
                (edit)="startEditBudgetLine($event)"
                (delete)="delete.emit($event)"
                (addTransaction)="addAllocatedTransaction($event)"
                (viewTransactions)="onViewTransactions($event)"
                (resetFromTemplate)="onResetFromTemplateClick($event)"
                (toggleCheck)="toggleCheck.emit($event)"
              />
            } @empty {
              <div class="text-center py-12 px-4">
                <div
                  class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
                >
                  <mat-icon class="text-primary !text-3xl"
                    >account_balance_wallet</mat-icon
                  >
                </div>
                <p class="text-body-large text-on-surface mb-2">
                  Pas encore d'enveloppe
                </p>
                <p class="text-body-medium text-on-surface-variant mb-6">
                  Crée ta première enveloppe pour commencer à voir clair
                </p>
                <button
                  matButton="filled"
                  (click)="add.emit()"
                  class="!rounded-full !px-6"
                  data-testid="add-first-line"
                >
                  <mat-icon>add</mat-icon>
                  Créer une enveloppe
                </button>
              </div>
            }

            <!-- Transactions section -->
            @if (transactionItems().length > 0) {
              <div class="pt-4 border-outline-variant">
                <h3 class="text-title-medium text-on-surface-variant mb-3">
                  Transactions
                </h3>
                @for (item of transactionItems(); track item.data.id) {
                  <mat-card
                    appearance="outlined"
                    class="mb-3"
                    [class.opacity-50]="item.metadata.isLoading"
                    [attr.data-testid]="'transaction-card-' + item.data.id"
                  >
                    <mat-card-content>
                      <div
                        class="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1 items-center"
                      >
                        <div class="min-w-0 space-y-0.5">
                          <span
                            class="text-body-medium font-medium block truncate"
                          >
                            {{ item.data.name }}
                          </span>
                          <div class="text-label-small text-on-surface-variant">
                            {{ item.data.kind | transactionLabel }}
                          </div>
                          @if (item.metadata.envelopeName) {
                            <div
                              class="flex items-center text-label-small text-on-surface-variant"
                            >
                              <mat-icon class="text-sm! leading-none! w-4! h-4!"
                                >folder</mat-icon
                              >
                              <span>{{ item.metadata.envelopeName }}</span>
                            </div>
                          }
                        </div>
                        <div
                          class="text-title-medium font-bold"
                          [class.text-financial-income]="item.data.amount > 0"
                          [class.text-error]="item.data.amount < 0"
                        >
                          {{
                            item.data.amount
                              | currency: 'CHF' : 'symbol' : '1.0-0'
                          }}
                        </div>
                        <div>
                          <button
                            matIconButton
                            (click)="deleteTransaction.emit(item.data.id)"
                            matTooltip="Supprimer"
                            [attr.data-testid]="'delete-tx-' + item.data.id"
                          >
                            <mat-icon class="text-xl!">delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </div>
        } @else {
          <!-- Desktop Card Grid View -->
          @if (budgetLineItems().length === 0) {
            <!-- Empty State -->
            <div class="text-center py-12 px-4">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-container/30 flex items-center justify-center"
              >
                <mat-icon class="text-primary !text-3xl"
                  >account_balance_wallet</mat-icon
                >
              </div>
              <p class="text-body-large text-on-surface mb-2">
                Pas encore d'enveloppe
              </p>
              <p class="text-body-medium text-on-surface-variant mb-6">
                Crée ta première enveloppe pour commencer à voir clair
              </p>
              <button
                matButton="filled"
                (click)="add.emit()"
                class="!rounded-full !px-6"
                data-testid="add-first-line"
              >
                <mat-icon>add</mat-icon>
                Créer une enveloppe
              </button>
            </div>
          } @else {
            <div class="space-y-4">
              <!-- Income Section -->
              @if (groupedBudgetLines().income.length > 0) {
                <pulpe-budget-section-group
                  title="Revenus"
                  icon="trending_up"
                  [itemCount]="groupedBudgetLines().income.length"
                >
                  @for (
                    item of groupedBudgetLines().income;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }

              <!-- Savings Section -->
              @if (groupedBudgetLines().saving.length > 0) {
                <pulpe-budget-section-group
                  title="Épargne"
                  icon="savings"
                  [itemCount]="groupedBudgetLines().saving.length"
                >
                  @for (
                    item of groupedBudgetLines().saving;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }

              <!-- Expenses Section -->
              @if (groupedBudgetLines().expense.length > 0) {
                <pulpe-budget-section-group
                  title="Dépenses"
                  icon="shopping_cart"
                  [itemCount]="groupedBudgetLines().expense.length"
                >
                  @for (
                    item of groupedBudgetLines().expense;
                    track item.data.id
                  ) {
                    <pulpe-budget-envelope-card
                      [item]="item"
                      (cardClick)="openDetailDialog($event)"
                      (edit)="startEditBudgetLine($event)"
                      (delete)="delete.emit($event)"
                      (addTransaction)="addAllocatedTransaction($event)"
                      (resetFromTemplate)="onResetFromTemplateClick($event)"
                      (toggleCheck)="toggleCheck.emit($event)"
                    />
                  }
                </pulpe-budget-section-group>
              }
            </div>
          }
        }
      </mat-card-content>
      @if (budgetTableData().length > 0) {
        <mat-card-actions
          class="!px-5 !py-4 border-t border-outline-variant/50"
        >
          <button
            matButton
            (click)="add.emit()"
            data-testid="add-budget-line"
            class="w-full justify-center gap-2 !h-11 !rounded-full
                   bg-primary-container/50 text-on-primary-container
                   hover:bg-primary-container/70 transition-colors"
          >
            <mat-icon>add</mat-icon>
            Ajouter une enveloppe
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

    /* Improved row interactions */
    .mat-mdc-row {
      transition: background-color 150ms ease-out;
    }

    .mat-mdc-row:hover {
      cursor: pointer;
      background-color: var(--mat-sys-surface-container-lowest);
    }

    /* Row height for better breathing */
    .mat-mdc-row:not(.group-header-row) {
      height: 64px;
    }

    .warn-bar {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }

    .chip-on-secondary-container {
      --mat-chip-label-text-color: var(--mat-sys-on-secondary-container);
    }

    /* Group headers with better visual separation */
    .group-header-row {
      background-color: var(--mat-sys-surface-container);
      border-top: 1px solid var(--mat-sys-outline-variant);
    }

    .group-header-row:first-of-type {
      border-top: none;
    }

    /* Checked row styling */
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
  // Signal inputs
  budgetLines = input.required<BudgetLineViewModel[]>();
  transactions = input.required<TransactionViewModel[]>();

  // Outputs
  update = output<BudgetLineUpdate>();
  delete = output<string>();
  deleteTransaction = output<string>();
  add = output<void>();
  viewAllocatedTransactions = output<{
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }>();
  createAllocatedTransaction = output<BudgetLine>();
  resetFromTemplate = output<string>();
  toggleCheck = output<string>();
  toggleTransactionCheck = output<string>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableDataProvider = inject(BudgetTableDataProvider);
  readonly #logger = inject(Logger);

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

  // View mode toggle state
  readonly viewMode = signal<BudgetTableViewMode>('envelopes');

  // Inline edit state
  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  // Responsive
  isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Full consumption data for outputs (needed for parent component)
  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(this.budgetLines(), this.transactions()),
  );

  // View Model with pre-computed values
  budgetTableData = computed(() => {
    const editingLine = this.inlineFormEditingItem();
    return this.#budgetTableDataProvider.provideTableData({
      budgetLines: this.budgetLines(),
      transactions: this.transactions(),
      editingLineId: editingLine?.data.id ?? null,
      viewMode: this.viewMode(),
    });
  });

  // Filtered items for mobile view
  readonly budgetLineItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is BudgetLineTableItem =>
        item.metadata.itemType === 'budget_line',
    ),
  );

  readonly transactionItems = computed(() =>
    this.budgetTableData().filter(
      (item): item is TransactionTableItem =>
        item.metadata.itemType === 'transaction',
    ),
  );

  // Desktop card grid: grouped budget lines by kind
  protected readonly groupedBudgetLines = computed(() => {
    const items = this.budgetLineItems();
    return {
      income: items.filter((item) => item.data.kind === 'income'),
      saving: items.filter((item) => item.data.kind === 'saving'),
      expense: items.filter((item) => item.data.kind === 'expense'),
    };
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

  // Edit methods
  startEdit(item: BudgetLineTableItem): void {
    if (this.isMobile()) {
      this.#openEditDialog(item);
      return;
    }
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

  startEditBudgetLine(item: BudgetLineTableItem): void {
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

  // Action handlers
  addAllocatedTransaction(budgetLine: BudgetLine): void {
    this.createAllocatedTransaction.emit(budgetLine);
  }

  onViewTransactions(item: BudgetLineTableItem): void {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    this.viewAllocatedTransactions.emit({
      budgetLine: item.data,
      consumption,
    });
  }

  onViewTransactionsFromLine(line: BudgetLineTableItem): void {
    this.onViewTransactions(line);
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

  // Desktop card grid: open detail dialog as side sheet
  protected openDetailDialog(item: BudgetLineTableItem): void {
    const dialogData: BudgetEnvelopeDetailDialogData = {
      item,
      transactions: this.transactions,
      onAddTransaction: (budgetLine) =>
        this.addAllocatedTransaction(budgetLine),
      onDeleteTransaction: (id) => this.deleteTransaction.emit(id),
      onToggleTransactionCheck: (id) => this.toggleTransactionCheck.emit(id),
    };

    this.#dialog.open(BudgetEnvelopeDetailPanel, {
      data: dialogData,
      panelClass: 'side-sheet-panel',
      position: { right: '0', top: '0' },
      height: '100vh',
      width: '480px',
      maxWidth: '90vw',
      autoFocus: false,
      closeOnNavigation: true,
    });
  }
}
