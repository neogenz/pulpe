import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type BudgetLine,
  type BudgetLineUpdate,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';

interface EditingLine {
  id: string;
  name: string;
  amount: number;
}

@Component({
  selector: 'pulpe-budget-lines-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    FormsModule,
    CurrencyPipe,
  ],
  host: {
    '[class.mobile-view]': 'isMobile()?.matches',
  },
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Prévisions du budget</mat-card-title>
        <mat-card-subtitle>
          Gérez vos revenus, dépenses et épargnes
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="overflow-x-auto">
        <table
          mat-table
          [dataSource]="budgetLines()"
          class="w-full min-w-[600px]"
        >
          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let line">
              <div class="flex items-center gap-2">
                <mat-icon [class]="getKindIconClass(line.kind)">
                  {{ getKindIcon(line.kind) }}
                </mat-icon>
                <span class="text-body-medium">{{
                  getKindLabel(line.kind)
                }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let line">
              @if (isEditing(line.id)) {
                <div class="py-2">
                  <mat-form-field
                    appearance="outline"
                    class="w-full"
                    subscriptSizing="dynamic"
                  >
                    <input
                      matInput
                      [(ngModel)]="editingLine()!.name"
                      placeholder="Nom de la ligne"
                      [attr.data-testid]="'edit-name-' + line.id"
                      class="text-body-medium"
                    />
                  </mat-form-field>
                </div>
              } @else {
                <span class="text-body-medium">{{ line.name }}</span>
              }
            </td>
          </ng-container>

          <!-- Recurrence Column -->
          <ng-container matColumnDef="recurrence">
            <th mat-header-cell *matHeaderCellDef>Fréquence</th>
            <td mat-cell *matCellDef="let line">
              <mat-chip
                [class]="getRecurrenceChipClass(line.recurrence)"
                class="text-label-medium font-medium"
              >
                {{ getRecurrenceLabel(line.recurrence) }}
              </mat-chip>
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Montant
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              @if (isEditing(line.id)) {
                <div class="py-2 flex justify-end">
                  <mat-form-field
                    appearance="outline"
                    class="w-28 md:w-36"
                    subscriptSizing="dynamic"
                  >
                    <input
                      matInput
                      type="number"
                      [(ngModel)]="editingLine()!.amount"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      [attr.data-testid]="'edit-amount-' + line.id"
                      class="text-body-medium text-right"
                    />
                    <span matTextSuffix class="text-body-small">CHF</span>
                  </mat-form-field>
                </div>
              } @else {
                <span
                  class="text-body-medium font-medium"
                  [class]="getAmountClass(line.kind)"
                >
                  {{ line.amount | currency: 'CHF' }}
                </span>
              }
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let line">
              <div class="flex gap-1 justify-end">
                @if (isEditing(line.id)) {
                  <button
                    mat-icon-button
                    (click)="saveEdit()"
                    [attr.aria-label]="'Save ' + line.name"
                    [attr.data-testid]="'save-' + line.id"
                    [disabled]="!isValidEdit()"
                  >
                    <mat-icon>check</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    (click)="cancelEdit()"
                    [attr.aria-label]="'Cancel editing ' + line.name"
                    [attr.data-testid]="'cancel-' + line.id"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                } @else {
                  <button
                    mat-icon-button
                    (click)="startEdit(line)"
                    [attr.aria-label]="'Edit ' + line.name"
                    [attr.data-testid]="'edit-' + line.id"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    (click)="deleteClicked.emit(line.id)"
                    [attr.aria-label]="'Delete ' + line.name"
                    [attr.data-testid]="'delete-' + line.id"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="currentColumns()"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: currentColumns()"
            class="hover:bg-[color-surface-container-low]"
          ></tr>

          <!-- No data row -->
          <tr class="mat-row" *matNoDataRow>
            <td
              class="mat-cell text-center py-8"
              [attr.colspan]="currentColumns().length"
            >
              <p class="text-body-medium text-[color-on-surface-variant]">
                Aucune prévision définie
              </p>
              <button
                mat-stroked-button
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
      @if (budgetLines().length > 0) {
        <mat-card-actions class="flex justify-center mb-2">
          <button
            mat-stroked-button
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
export class BudgetLinesTable {
  budgetLines = input.required<BudgetLine[]>();
  updateClicked = output<{ id: string; update: BudgetLineUpdate }>();
  deleteClicked = output<string>();
  addClicked = output<void>();

  #breakpointObserver = inject(BreakpointObserver);

  displayedColumns = ['type', 'name', 'recurrence', 'amount', 'actions'];
  displayedColumnsMobile = ['name', 'amount', 'actions'];
  editingLine = signal<EditingLine | null>(null);

  isMobile = toSignal(
    this.#breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small]),
    { initialValue: { matches: false, breakpoints: {} } },
  );

  currentColumns = computed(() =>
    this.isMobile()?.matches
      ? this.displayedColumnsMobile
      : this.displayedColumns,
  );

  isEditing(id: string): boolean {
    return this.editingLine()?.id === id;
  }

  startEdit(line: BudgetLine): void {
    this.editingLine.set({
      id: line.id,
      name: line.name,
      amount: line.amount,
    });
  }

  cancelEdit(): void {
    this.editingLine.set(null);
  }

  saveEdit(): void {
    const editing = this.editingLine();
    if (editing && this.isValidEdit()) {
      const updateData = {
        id: editing.id,
        update: {
          name: editing.name.trim(),
          amount: editing.amount,
        },
      };
      this.editingLine.set(null);
      this.updateClicked.emit(updateData);
    }
  }

  isValidEdit(): boolean {
    const editing = this.editingLine();
    return !!(editing && editing.name.trim().length > 0 && editing.amount > 0);
  }

  getKindIcon(kind: TransactionKind): string {
    const icons: Record<TransactionKind, string> = {
      INCOME: 'trending_up',
      FIXED_EXPENSE: 'trending_down',
      SAVINGS_CONTRIBUTION: 'savings',
    };
    return icons[kind];
  }

  getKindLabel(kind: TransactionKind): string {
    const labels: Record<TransactionKind, string> = {
      INCOME: 'Revenu',
      FIXED_EXPENSE: 'Dépense',
      SAVINGS_CONTRIBUTION: 'Épargne',
    };
    return labels[kind];
  }

  getKindIconClass(kind: TransactionKind): string {
    const classes: Record<TransactionKind, string> = {
      INCOME: 'text-financial-income',
      FIXED_EXPENSE: 'text-financial-negative',
      SAVINGS_CONTRIBUTION: 'text-[color-primary]',
    };
    return classes[kind];
  }

  getAmountClass(kind: TransactionKind): string {
    const classes: Record<TransactionKind, string> = {
      INCOME: 'text-financial-income',
      FIXED_EXPENSE: 'text-financial-negative',
      SAVINGS_CONTRIBUTION: 'text-[color-primary]',
    };
    return classes[kind];
  }

  getRecurrenceLabel(recurrence: TransactionRecurrence): string {
    const labels: Record<TransactionRecurrence, string> = {
      fixed: 'Tous les mois',
      variable: 'Variable',
      one_off: 'Une seule fois',
    };
    return labels[recurrence] || recurrence;
  }

  getRecurrenceChipClass(recurrence: TransactionRecurrence): string {
    const classes: Record<TransactionRecurrence, string> = {
      fixed: 'bg-[color-primary-container] text-[color-on-primary-container]',
      variable:
        'bg-[color-tertiary-container] text-[color-on-tertiary-container]',
      one_off:
        'bg-[color-secondary-container] text-[color-on-secondary-container]',
    };
    return (
      classes[recurrence] ||
      'bg-[color-surface-container-high] text-[color-on-surface]'
    );
  }
}
