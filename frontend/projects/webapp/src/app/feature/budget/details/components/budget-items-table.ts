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
import { RouterLink } from '@angular/router';
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
} from '@pulpe/shared';
import { EditBudgetLineDialog } from './edit-budget-line-dialog';
import { Logger } from '@core/logging/logger';
import {
  BudgetTableMapper,
  type BudgetLineTableItem,
  type TableItem,
} from '../../services/budget-table-mapper';
import {
  TransactionIconPipe,
  TransactionLabelPipe,
  RecurrenceLabelPipe,
} from '@ui/transaction-display';
import { RolloverFormatPipe } from '../../pipes';

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
    RouterLink,
    CurrencyPipe,
    TransactionIconPipe,
    TransactionLabelPipe,
    RecurrenceLabelPipe,
    RolloverFormatPipe,
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
          [dataSource]="budgetTableData().items"
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
                    <mat-icon
                      class="flex-shrink-0"
                      [class.text-financial-income]="
                        line.data.kind === 'income'
                      "
                      [class.text-financial-negative]="
                        line.data.kind === 'expense'
                      "
                      [class.text-primary]="line.data.kind === 'saving'"
                    >
                      {{ line.data.kind | transactionIcon }}
                    </mat-icon>
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
                        class="text-body-medium font-semibold"
                      >
                        {{ line.data.name | rolloverFormat }}
                      </a>
                    } @else {
                      <span class="text-body-medium font-semibold">
                        {{ line.data.name | rolloverFormat }}
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
                  [class.bg-primary-container]="
                    line.data.recurrence === 'fixed'
                  "
                  [class.text-on-primary-container]="
                    line.data.recurrence === 'fixed'
                  "
                  [class.bg-tertiary-container]="
                    line.data.recurrence === 'variable'
                  "
                  [class.text-on-tertiary-container]="
                    line.data.recurrence === 'variable'
                  "
                  [class.bg-secondary-container]="
                    line.data.recurrence === 'one_off'
                  "
                  [class.text-on-secondary-container]="
                    line.data.recurrence === 'one_off'
                  "
                  class="text-label-medium font-medium"
                >
                  {{ line.data.recurrence | recurrenceLabel }}
                </mat-chip>
              } @else {
                <mat-chip
                  class="bg-secondary-container text-on-secondary-container text-label-medium font-medium"
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
                  class="text-body-medium font-medium"
                  [class.text-financial-income]="line.data.kind === 'income'"
                  [class.text-financial-negative]="line.data.kind === 'expense'"
                  [class.text-primary]="line.data.kind === 'saving'"
                  [class.italic]="line.metadata.isRollover"
                >
                  {{ line.data.amount | currency: 'CHF' }}
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
                [class.text-financial-income]="
                  line.metadata.cumulativeBalance >= 0
                "
                [class.text-financial-negative]="
                  line.metadata.cumulativeBalance < 0
                "
              >
                {{
                  line.metadata.cumulativeBalance
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
                  @if (
                    line.metadata.itemType === 'budget_line' &&
                    !line.metadata.isRollover
                  ) {
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
                  @if (!line.metadata.isRollover) {
                    <button
                      matIconButton
                      (click)="deleteClicked.emit(line.data.id)"
                      [attr.aria-label]="'Delete ' + line.data.name"
                      data-testid="delete-button"
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
      @if (budgetTableData().items.length > 0) {
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
export class BudgetItemsTable {
  // Inputs - pure data
  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();
  operationsInProgress = input<Set<string>>(new Set());

  // Outputs - events only
  update = output<BudgetLineUpdate>();
  deleteClicked = output<string>();
  addClicked = output<void>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableMapper = inject(BudgetTableMapper);
  readonly #logger = inject(Logger);

  // UI configuration
  displayedColumns = ['name', 'recurrence', 'amount', 'remaining', 'actions'];
  displayedColumnsMobile = ['name', 'amount', 'remaining', 'actions'];

  protected inlineFormEditingItem = signal<BudgetLineTableItem | null>(null);
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

  // View Model - single computed that delegates to service
  budgetTableData = computed(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    const operationsInProgress = this.operationsInProgress();
    const editingLine = this.inlineFormEditingItem();

    // Component is now logic-free - just passes data to service
    return this.#budgetTableMapper.prepareBudgetTableData({
      budgetLines,
      transactions,
      operationsInProgress,
      editingLineId: editingLine?.data.id ?? null,
    });
  });

  // Track function for performance optimization
  readonly trackByRow = (_: number, row: TableItem): string => row.data.id;

  startEdit(item: BudgetLineTableItem): void {
    // Only allow editing budget lines, not transactions
    //if (!this.#isBudgetLineItem(item)) return;

    // On mobile, open dialog for editing
    if (this.isMobile()?.matches) {
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
      this.inlineFormEditingItem.set(item);
      this.editForm.patchValue({
        name: item.data.name,
        amount: item.data.amount,
      });
    }
  }

  cancelEdit(): void {
    this.inlineFormEditingItem.set(null);
    this.editForm.reset();
  }

  saveEdit(): void {
    const editingId = this.inlineFormEditingItem()?.data.id;
    if (editingId && this.editForm.valid) {
      const value = this.editForm.getRawValue();
      const updateData = {
        id: editingId,
        name: value.name!.trim(),
        amount: value.amount!,
      };
      this.inlineFormEditingItem.set(null);
      this.editForm.reset();
      this.update.emit(updateData);
    }
  }

  /*
  #isBudgetLineItem(item: TableItem): item is TableItem & {
    data: BudgetLine;
    metadata: { itemType: 'budget_line' };
  } {
    return item.metadata.itemType === 'budget_line';
  }*/
}
