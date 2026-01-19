import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  calculateAllEnrichedConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import { map } from 'rxjs/operators';
import { BudgetGrid } from './budget-grid';
import { BudgetTableView } from './budget-table/budget-table-view';
import { type BudgetLineViewModel } from './models/budget-line-view-model';
import { type TransactionViewModel } from './models/transaction-view-model';
import {
  type BudgetLineTableItem,
  type BudgetViewMode,
  BudgetItemDataProvider,
  type TransactionTableItem,
} from './data-core';
import { BudgetViewToggle } from './components';

const VIEW_MODE_STORAGE_KEY = 'pulpe-budget-desktop-view';

/**
 * Unified container component for displaying budget items.
 * Orchestrates between grid view (cards) and table view (mat-table).
 */
@Component({
  selector: 'pulpe-budget-items',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    BudgetGrid,
    BudgetTableView,
    BudgetViewToggle,
  ],
  providers: [BudgetItemDataProvider],
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
          @if (!isMobile()) {
            <pulpe-budget-view-toggle [(viewMode)]="viewMode" />
          }
        </div>
      </mat-card-header>

      <mat-card-content class="py-4!">
        @if (isMobile() || viewMode() === 'envelopes') {
          <pulpe-budget-grid
            [budgetLineItems]="budgetLineItems()"
            [transactionItems]="transactionItems()"
            [transactions]="transactionsSignal"
            [isMobile]="isMobile()"
            (edit)="startEditBudgetLine($event)"
            (delete)="delete.emit($event)"
            (deleteTransaction)="deleteTransaction.emit($event)"
            (add)="add.emit()"
            (addTransaction)="createAllocatedTransaction.emit($event)"
            (viewTransactions)="onViewTransactions($event)"
            (resetFromTemplate)="onResetFromTemplateClick($event)"
            (toggleCheck)="toggleCheck.emit($event)"
            (toggleTransactionCheck)="toggleTransactionCheck.emit($event)"
          />
        } @else {
          <pulpe-budget-table-view
            [tableData]="budgetTableData()"
            (update)="update.emit($event)"
            (delete)="delete.emit($event)"
            (add)="add.emit()"
            (addTransaction)="createAllocatedTransaction.emit($event)"
            (viewTransactions)="onViewTransactions($event)"
            (resetFromTemplate)="resetFromTemplate.emit($event)"
            (toggleCheck)="toggleCheck.emit($event)"
            (toggleTransactionCheck)="toggleTransactionCheck.emit($event)"
          />
        }
      </mat-card-content>

      @if (budgetTableData().length > 0) {
        <mat-card-actions
          class="!px-5 !py-4 border-t border-outline-variant/50 justify-center"
        >
          <button
            matButton
            (click)="add.emit()"
            data-testid="add-budget-line"
            class="gap-2 !h-11 !rounded-full !px-6"
          >
            <mat-icon>add</mat-icon>
            Ajouter une enveloppe
          </button>
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetItemsContainer {
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #budgetItemDataProvider = inject(BudgetItemDataProvider);

  // Signal inputs
  readonly budgetLines = input.required<BudgetLineViewModel[]>();
  readonly transactions = input.required<TransactionViewModel[]>();

  // Outputs
  readonly update = output<BudgetLineUpdate>();
  readonly delete = output<string>();
  readonly deleteTransaction = output<string>();
  readonly add = output<void>();
  readonly viewAllocatedTransactions = output<{
    budgetLine: BudgetLine;
    consumption: BudgetLineConsumption;
  }>();
  readonly createAllocatedTransaction = output<BudgetLine>();
  readonly resetFromTemplate = output<string>();
  readonly toggleCheck = output<string>();
  readonly toggleTransactionCheck = output<string>();

  // View mode toggle state (persisted in localStorage for desktop)
  readonly viewMode = signal<BudgetViewMode>(this.#getInitialViewMode());

  // Responsive
  readonly isMobile = toSignal(
    this.#breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Signal wrapper for transactions (used by grid detail panel)
  readonly transactionsSignal = computed(() => this.transactions());

  // Full consumption data for outputs
  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(this.budgetLines(), this.transactions()),
  );

  // Inline edit state
  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);

  // View Model with pre-computed values
  readonly budgetTableData = computed(() => {
    const editingLine = this.inlineFormEditingItem();
    return this.#budgetItemDataProvider.provideTableData({
      budgetLines: this.budgetLines(),
      transactions: this.transactions(),
      editingLineId: editingLine?.data.id ?? null,
      viewMode: this.viewMode(),
    });
  });

  // Filtered items for grid view
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

  constructor() {
    // Persist view mode changes to localStorage (desktop only)
    effect(() => {
      const mode = this.viewMode();
      const mobile = this.isMobile();
      if (!mobile) {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
      }
    });
  }

  #getInitialViewMode(): BudgetViewMode {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'table') {
      return 'table';
    }
    return 'envelopes';
  }

  // Edit method for grid view (opens dialog)
  protected startEditBudgetLine(item: BudgetLineTableItem): void {
    // The grid component handles the edit dialog internally
    this.update.emit({
      id: item.data.id,
      name: item.data.name,
      amount: item.data.amount,
      isManuallyAdjusted: item.data.isManuallyAdjusted,
    });
  }

  protected onViewTransactions(item: BudgetLineTableItem): void {
    const consumption = this.#consumptions().get(item.data.id);
    if (!consumption) return;
    this.viewAllocatedTransactions.emit({
      budgetLine: item.data,
      consumption,
    });
  }

  protected onResetFromTemplateClick(item: BudgetLineTableItem): void {
    this.resetFromTemplate.emit(item.data.id);
  }
}
