import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import {
  type BudgetLine,
  type Transaction,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { EditBudgetLineDialog } from './edit-budget-line-dialog';
import {
  BudgetCalculator,
  type BudgetItemDisplay,
} from '@core/budget/budget-calculator';

interface BudgetItemViewModel {
  id: string;
  name: string;
  amount: number;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  itemType: 'budget_line' | 'transaction';
  kindIcon: string;
  kindLabel: string;
  kindIconClass: string;
  amountClass: string;
  recurrenceLabel: string;
  recurrenceChipClass: string;
  isEditing: boolean;
  isLoading: boolean;
  cumulativeBalance: number;
  cumulativeBalanceClass: string;
}

interface SectionHeaderRow {
  type: 'section_header';
  id: string;
  title: string;
}

type DataRow = BudgetItemViewModel & {
  type: 'data_row';
};

type TableRow = SectionHeaderRow | DataRow;

@Component({
  selector: 'pulpe-budget-items-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    ReactiveFormsModule,
    CurrencyPipe,
  ],
  host: {
    '[class.mobile-view]': 'isMobile()?.matches',
  },
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
          [dataSource]="budgetItemViewModels()"
          class="w-full min-w-[600px]"
        >
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let line">
              @if (line.isEditing) {
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
                      [attr.data-testid]="'edit-name-' + line.id"
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
                    [matTooltip]="line.kindLabel"
                    matTooltipPosition="above"
                    [attr.aria-describedby]="'type-tooltip-' + line.id"
                    [attr.aria-label]="'Type de transaction: ' + line.kindLabel"
                    tabindex="0"
                  >
                    <mat-icon [class]="line.kindIconClass">
                      {{ line.kindIcon }}
                    </mat-icon>
                    <span class="text-body-medium font-semibold">{{
                      line.name
                    }}</span>
                  </span>
                </div>
              }
            </td>
          </ng-container>

          <!-- Recurrence Column -->
          <ng-container matColumnDef="recurrence">
            <th mat-header-cell *matHeaderCellDef>Fréquence</th>
            <td mat-cell *matCellDef="let line">
              <mat-chip
                [class]="line.recurrenceChipClass"
                class="text-label-medium font-medium"
              >
                {{ line.recurrenceLabel }}
              </mat-chip>
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Montant
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              @if (line.isEditing) {
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
                      step="0.01"
                      min="0"
                      [attr.data-testid]="'edit-amount-' + line.id"
                      class="text-body-medium text-right"
                      (keydown.enter)="saveEdit()"
                      (keydown.escape)="cancelEdit()"
                    />
                    <span matTextSuffix>CHF</span>
                  </mat-form-field>
                </form>
              } @else {
                <span
                  class="text-body-medium font-medium"
                  [class]="line.amountClass"
                >
                  {{ line.amount | currency: 'CHF' }}
                </span>
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
                class="text-body-medium font-medium"
                [class]="line.cumulativeBalanceClass"
              >
                {{
                  line.cumulativeBalance
                    | currency: 'CHF' : 'symbol' : '1.0-2' : 'fr-CH'
                }}
              </span>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let line">
              <div class="flex gap-1 justify-end items-center">
                @if (line.isEditing) {
                  <div class="flex items-center gap-2">
                    <button
                      matButton
                      (click)="cancelEdit()"
                      [attr.aria-label]="'Cancel editing ' + line.name"
                      [attr.data-testid]="'cancel-' + line.id"
                      class="density-3"
                    >
                      <mat-icon class="!text-base mr-1">close</mat-icon>
                      Annuler
                    </button>
                    <button
                      matButton="filled"
                      (click)="saveEdit()"
                      [attr.aria-label]="'Save ' + line.name"
                      [attr.data-testid]="'save-' + line.id"
                      [disabled]="!editForm.valid"
                      class="density-3"
                    >
                      <mat-icon class="!text-base mr-1">check</mat-icon>
                      Enregistrer
                    </button>
                  </div>
                } @else {
                  @if (line.itemType === 'budget_line') {
                    <button
                      matIconButton
                      (click)="startEdit(line)"
                      [attr.aria-label]="'Edit ' + line.name"
                      [attr.data-testid]="'edit-' + line.id"
                      [disabled]="line.isLoading"
                      class="!w-10 !h-10"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                  <button
                    matIconButton
                    (click)="deleteClicked.emit(line.id)"
                    [attr.aria-label]="'Delete ' + line.name"
                    data-testid="delete-button"
                    [disabled]="line.isLoading"
                    class="!w-10 !h-10 text-error"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <!-- Section Header Column -->
          <ng-container matColumnDef="section-header">
            <td
              mat-cell
              *matCellDef="let row"
              [attr.colspan]="currentColumns().length"
              class=""
            >
              <h3 class="text-title-medium font-bold text-on-surface m-0">
                {{ row.title }}
              </h3>
            </td>
          </ng-container>

          <tr
            mat-header-row
            *matHeaderRowDef="currentColumns(); sticky: true"
          ></tr>
          <tr
            mat-row
            *matRowDef="
              let row;
              columns: ['section-header'];
              when: isSectionHeader;
              trackBy: trackByRow
            "
            class="!hover:bg-transparent"
          ></tr>
          <tr
            mat-row
            *matRowDef="
              let row;
              columns: currentColumns();
              when: isDataRow;
              trackBy: trackByRow
            "
            class="hover:bg-surface-container-low transition-opacity"
            [class.opacity-50]="row.isLoading"
            [class.pointer-events-none]="row.isLoading"
            [attr.data-testid]="'budget-line-' + row.name"
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
                (click)="addClicked.emit()"
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
      @if (budgetItemViewModels().length > 0) {
        <mat-card-actions class="flex justify-center mb-2">
          <button
            matButton="outlined"
            (click)="addClicked.emit()"
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
export class BudgetItemsTable {
  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();
  operationsInProgress = input<Set<string>>(new Set());
  updateClicked = output<{ id: string; update: BudgetLineUpdate }>();
  deleteClicked = output<string>();
  addClicked = output<void>();

  #breakpointObserver = inject(BreakpointObserver);
  #fb = inject(FormBuilder);
  #dialog = inject(MatDialog);
  #destroyRef = inject(DestroyRef);
  #budgetCalculator = inject(BudgetCalculator);

  displayedColumns = ['name', 'recurrence', 'amount', 'remaining', 'actions'];
  displayedColumnsMobile = ['name', 'amount', 'remaining', 'actions'];

  editingLineId = signal<string | null>(null);
  readonly editForm = this.#fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  isMobile = toSignal(
    this.#breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small]),
    { initialValue: { matches: false, breakpoints: {} } },
  );

  currentColumns = computed(() =>
    this.isMobile()?.matches
      ? this.displayedColumnsMobile
      : this.displayedColumns,
  );

  // View models with pre-computed display values and cumulative balance
  budgetItemViewModels = computed((): TableRow[] => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    const inProgress = this.operationsInProgress();
    const editingId = this.editingLineId();

    // Use budget calculator to get sorted items with cumulative balance
    const itemsWithBalance =
      this.#budgetCalculator.composeBudgetItemsWithBalance(
        budgetLines,
        transactions,
      );

    const result: TableRow[] = [];
    const budgetLineRows: DataRow[] = [];
    const transactionRows: DataRow[] = [];

    // Separate items by type and convert to DataRow
    itemsWithBalance.forEach((itemDisplay: BudgetItemDisplay) => {
      const item = itemDisplay.item;
      const recurrence: TransactionRecurrence =
        'recurrence' in item ? item.recurrence : 'one_off';

      const dataRow: DataRow = {
        type: 'data_row',
        id: item.id,
        name: item.name,
        amount: item.amount,
        kind: item.kind as TransactionKind,
        recurrence: recurrence,
        itemType: itemDisplay.itemType,
        kindIcon: this.#kindIcons[item.kind as TransactionKind],
        kindLabel: this.#kindLabels[item.kind as TransactionKind],
        kindIconClass: this.#kindIconClasses[item.kind as TransactionKind],
        amountClass: this.#amountClasses[item.kind as TransactionKind],
        recurrenceLabel: this.#recurrenceLabels[recurrence],
        recurrenceChipClass: this.#recurrenceChipClasses[recurrence],
        isEditing:
          itemDisplay.itemType === 'budget_line' && editingId === item.id,
        isLoading: inProgress.has(item.id),
        cumulativeBalance: itemDisplay.cumulativeBalance,
        cumulativeBalanceClass:
          itemDisplay.cumulativeBalance >= 0
            ? 'text-financial-income'
            : 'text-financial-negative',
      };

      if (itemDisplay.itemType === 'budget_line') {
        budgetLineRows.push(dataRow);
      } else {
        transactionRows.push(dataRow);
      }
    });

    // Add budget lines first
    result.push(...budgetLineRows);

    // Add section header if there are transactions
    if (transactionRows.length > 0) {
      result.push({
        type: 'section_header',
        id: 'transactions-header',
        title: 'Ajouté durant le mois',
      });
      result.push(...transactionRows);
    }

    return result;
  });

  // Mapping constants
  #kindIcons: Record<TransactionKind, string> = {
    income: 'trending_up',
    expense: 'trending_down',
    saving: 'savings',
  };

  #kindLabels: Record<TransactionKind, string> = {
    income: 'Revenu',
    expense: 'Dépense',
    saving: 'Épargne',
  };

  #kindIconClasses: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  #amountClasses: Record<TransactionKind, string> = {
    income: 'text-financial-income',
    expense: 'text-financial-negative',
    saving: 'text-primary',
  };

  #recurrenceLabels: Record<TransactionRecurrence, string> = {
    fixed: 'Tous les mois',
    variable: 'Variable',
    one_off: 'Une seule fois',
  };

  #recurrenceChipClasses: Record<TransactionRecurrence, string> = {
    fixed: 'bg-primary-container text-on-primary-container',
    variable: 'bg-tertiary-container text-on-tertiary-container',
    one_off: 'bg-secondary-container text-on-secondary-container',
  };

  // Predicate functions for row types
  readonly isSectionHeader = (
    _: number,
    row: TableRow,
  ): row is SectionHeaderRow => row.type === 'section_header';

  readonly isDataRow = (_: number, row: TableRow): row is DataRow =>
    row.type === 'data_row';

  // Track function for performance optimization
  readonly trackByRow = (_: number, row: TableRow): string => row.id;

  startEdit(item: DataRow): void {
    // Only allow editing budget lines, not transactions
    if (item.itemType !== 'budget_line') return;

    // On mobile, open dialog for editing
    if (this.isMobile()?.matches) {
      const budgetLine = this.budgetLines().find((l) => l.id === item.id);
      if (!budgetLine) return;

      try {
        const dialogRef = this.#dialog.open(EditBudgetLineDialog, {
          data: { budgetLine },
          width: '400px',
          maxWidth: '90vw',
        });

        dialogRef
          .afterClosed()
          .pipe(takeUntilDestroyed(this.#destroyRef))
          .subscribe((update: BudgetLineUpdate | undefined) => {
            if (update) {
              this.updateClicked.emit({ id: item.id, update });
            }
          });
      } catch (error) {
        console.error('Failed to open edit dialog:', error);
        // Fallback to inline editing
        this.editingLineId.set(item.id);
        this.editForm.patchValue({
          name: item.name,
          amount: item.amount,
        });
      }
    } else {
      // Desktop: inline editing
      this.editingLineId.set(item.id);
      this.editForm.patchValue({
        name: item.name,
        amount: item.amount,
      });
    }
  }

  cancelEdit(): void {
    this.editingLineId.set(null);
    this.editForm.reset();
  }

  saveEdit(): void {
    const editingId = this.editingLineId();
    if (editingId && this.editForm.valid) {
      const value = this.editForm.getRawValue();
      const updateData = {
        id: editingId,
        update: {
          name: value.name!.trim(),
          amount: value.amount!,
        },
      };
      this.editingLineId.set(null);
      this.editForm.reset();
      this.updateClicked.emit(updateData);
    }
  }
}
