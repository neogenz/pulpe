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
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import {
  calculateAllEnrichedConsumptions,
  type BudgetLineConsumption,
} from '@core/budget';
import { STORAGE_KEYS, StorageService } from '@core/storage';
import { type BudgetLine, type BudgetLineUpdate } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { BudgetGrid } from './budget-grid';
import { BudgetTable } from './budget-table/budget-table';
import { EditBudgetLineDialog } from './edit-budget-line/edit-budget-line-dialog';
import { type BudgetLineViewModel } from './models/budget-line-view-model';
import { type TransactionViewModel } from './models/transaction-view-model';
import {
  type BudgetLineTableItem,
  type BudgetViewMode,
  BudgetItemDataProvider,
  type TransactionTableItem,
} from './data-core';
import { BudgetViewToggle } from './components';

/**
 * Unified container component for displaying budget items.
 * Orchestrates between grid view (cards) and table view (mat-table).
 */
@Component({
  selector: 'pulpe-budget-items',
  imports: [
    MatButtonModule,
    MatIconModule,
    BudgetGrid,
    BudgetTable,
    BudgetViewToggle,
  ],
  providers: [BudgetItemDataProvider],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-title-large font-medium">Tes enveloppes</h2>
          <p class="text-body-medium text-on-surface-variant">
            {{ budgetLines().length }} prévisions ce mois
          </p>
        </div>
        @if (!isMobile()) {
          <pulpe-budget-view-toggle [(viewMode)]="viewMode" />
        }
      </div>

      <!-- Content -->
      @if (isMobile() || viewMode() === 'envelopes') {
        <pulpe-budget-grid
          [budgetLineItems]="budgetLineItems()"
          [transactionItems]="transactionItems()"
          [transactions]="transactions()"
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
        <pulpe-budget-table
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

      <!-- Footer -->
      @if (budgetTableData().length > 0) {
        <div class="flex justify-center pt-2">
          <button
            matButton
            (click)="add.emit()"
            data-testid="add-budget-line"
            class="gap-2 !h-11 !rounded-full !px-6"
          >
            <mat-icon>add</mat-icon>
            Ajouter une enveloppe
          </button>
        </div>
      }
    </div>
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
  readonly #dialog = inject(MatDialog);
  readonly #storageService = inject(StorageService);

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

  // Full consumption data for outputs
  readonly #consumptions = computed(() =>
    calculateAllEnrichedConsumptions(this.budgetLines(), this.transactions()),
  );

  // View Model with pre-computed values
  readonly budgetTableData = computed(() =>
    this.#budgetItemDataProvider.provideTableData({
      budgetLines: this.budgetLines(),
      transactions: this.transactions(),
      viewMode: this.viewMode(),
    }),
  );

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
        this.#storageService.setString(STORAGE_KEYS.BUDGET_DESKTOP_VIEW, mode);
      }
    });
  }

  #getInitialViewMode(): BudgetViewMode {
    const stored = this.#storageService.getString(
      STORAGE_KEYS.BUDGET_DESKTOP_VIEW,
    );
    if (stored === 'table') {
      return 'table';
    }
    return 'envelopes';
  }

  protected async startEditBudgetLine(
    item: BudgetLineTableItem,
  ): Promise<void> {
    const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
      data: { budgetLine: item.data },
      width: '400px',
      maxWidth: '90vw',
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result) {
      this.update.emit(result);
    }
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
