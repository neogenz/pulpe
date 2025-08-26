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
} from '@pulpe/shared';
import { EditBudgetLineDialog } from './edit-budget-line-dialog';
import {
  BudgetTableMapper,
  type TableRow,
  type SectionHeaderRow,
  type DataRow,
} from '../../services/budget-table-mapper';

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
                    [class.font-bold]="line.isRollover"
                    [class.italic]="line.isRollover"
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
                  [class.font-bold]="line.isRollover"
                  [class.italic]="line.isRollover"
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
                  @if (line.itemType === 'budget_line' && !line.isRollover) {
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
                  @if (!line.isRollover) {
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
  // Inputs - pure data
  budgetLines = input.required<BudgetLine[]>();
  transactions = input.required<Transaction[]>();
  operationsInProgress = input<Set<string>>(new Set());

  // Outputs - events only
  updateClicked = output<{ id: string; update: BudgetLineUpdate }>();
  deleteClicked = output<string>();
  addClicked = output<void>();

  // Services
  readonly #breakpointObserver = inject(BreakpointObserver);
  readonly #fb = inject(FormBuilder);
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #budgetTableMapper = inject(BudgetTableMapper);

  // UI configuration
  displayedColumns = ['name', 'recurrence', 'amount', 'remaining', 'actions'];
  displayedColumnsMobile = ['name', 'amount', 'remaining', 'actions'];

  // UI state
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

  // View Model - single computed that delegates to service
  tableViewModel = computed(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    const operationsInProgress = this.operationsInProgress();
    const editingLineId = this.editingLineId();

    // Component is now logic-free - just passes data to service
    return this.#budgetTableMapper.prepareBudgetTableData(
      budgetLines,
      transactions,
      operationsInProgress,
      editingLineId,
    );
  });

  // Direct binding properties for template
  budgetItemViewModels = computed(() => this.tableViewModel().rows);

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
