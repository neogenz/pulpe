import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
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
  selector: 'pulpe-budget-line-table',
  imports: [
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    CurrencyPipe,
  ],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ getTitle() }}</mat-card-title>
        <mat-card-subtitle>
          Total: {{ total() | currency: 'CHF' }}
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <table mat-table [dataSource]="budgetLines()" class="w-full">
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let line">
              @if (isEditing(line.id)) {
                <mat-form-field appearance="outline" class="w-full dense-field">
                  <input
                    matInput
                    [(ngModel)]="editingLine()!.name"
                    placeholder="Nom de la ligne"
                    [attr.data-testid]="'edit-name-' + line.id"
                  />
                </mat-form-field>
              } @else {
                <span class="text-body-medium">{{ line.name }}</span>
              }
            </td>
          </ng-container>

          <!-- Recurrence Column -->
          <ng-container matColumnDef="recurrence">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let line">
              <span class="text-label-medium text-[color-on-surface-variant]">
                {{ getRecurrenceLabel(line.recurrence) }}
              </span>
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">
              Montant
            </th>
            <td mat-cell *matCellDef="let line" class="text-right">
              @if (isEditing(line.id)) {
                <mat-form-field appearance="outline" class="w-32 dense-field">
                  <input
                    matInput
                    type="number"
                    [(ngModel)]="editingLine()!.amount"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    [attr.data-testid]="'edit-amount-' + line.id"
                  />
                  <span matTextSuffix>CHF</span>
                </mat-form-field>
              } @else {
                <span class="text-body-medium font-medium">
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

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr
            mat-row
            *matRowDef="let row; columns: displayedColumns"
            class="hover:bg-[color-surface-container-low]"
          ></tr>

          <!-- No data row -->
          <tr class="mat-row" *matNoDataRow>
            <td
              class="mat-cell text-center py-8"
              [attr.colspan]="displayedColumns.length"
            >
              <p class="text-body-medium text-[color-on-surface-variant]">
                {{ getEmptyMessage() }}
              </p>
            </td>
          </tr>
        </table>
      </mat-card-content>
      <mat-card-actions>
        <button
          mat-stroked-button
          (click)="addClicked.emit()"
          [attr.data-testid]="'add-' + kind()"
        >
          <mat-icon>add</mat-icon>
          {{ getAddButtonLabel() }}
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .dense-field {
      ::ng-deep .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
      }
      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
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
export class BudgetLineTable {
  budgetLines = input.required<BudgetLine[]>();
  kind = input.required<TransactionKind>();
  updateClicked = output<{ id: string; update: BudgetLineUpdate }>();
  deleteClicked = output<string>();
  addClicked = output<void>();

  displayedColumns = ['name', 'recurrence', 'amount', 'actions'];
  editingLine = signal<EditingLine | null>(null);

  total = computed(() =>
    this.budgetLines().reduce((sum, line) => sum + line.amount, 0),
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
      // Create a local copy of the values before emitting
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

  getTitle(): string {
    const titles: Record<TransactionKind, string> = {
      INCOME: 'Revenus',
      FIXED_EXPENSE: 'Dépenses fixes',
      SAVINGS_CONTRIBUTION: 'Épargne',
    };
    return titles[this.kind()];
  }

  getEmptyMessage(): string {
    const messages: Record<TransactionKind, string> = {
      INCOME: 'Aucun revenu défini',
      FIXED_EXPENSE: 'Aucune dépense définie',
      SAVINGS_CONTRIBUTION: 'Aucune épargne définie',
    };
    return messages[this.kind()];
  }

  getAddButtonLabel(): string {
    const labels: Record<TransactionKind, string> = {
      INCOME: 'Ajouter un revenu',
      FIXED_EXPENSE: 'Ajouter une dépense',
      SAVINGS_CONTRIBUTION: 'Ajouter une épargne',
    };
    return labels[this.kind()];
  }

  getRecurrenceLabel(recurrence: TransactionRecurrence): string {
    const labels: Record<TransactionRecurrence, string> = {
      fixed: 'Fixe',
      variable: 'Variable',
      one_off: 'Ponctuel',
    };
    return labels[recurrence] || recurrence;
  }
}
