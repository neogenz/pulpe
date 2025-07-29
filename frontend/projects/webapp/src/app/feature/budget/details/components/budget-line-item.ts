import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { type BudgetLine, type BudgetLineUpdate } from '@pulpe/shared';

@Component({
  selector: 'pulpe-budget-line-item',
  imports: [
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
    @if (isEditing()) {
      <div
        class="flex flex-col gap-4 p-4 bg-[color-surface-container-low] rounded-[radius-corner-medium]"
      >
        <mat-form-field appearance="fill" class="w-full">
          <mat-label>Nom</mat-label>
          <input
            matInput
            [(ngModel)]="editedLine.name"
            placeholder="Nom de la ligne"
            [attr.data-testid]="'line-name-' + budgetLine().id"
          />
        </mat-form-field>

        <mat-form-field appearance="fill" class="w-full">
          <mat-label>Montant</mat-label>
          <input
            matInput
            type="number"
            [(ngModel)]="editedLine.amount"
            placeholder="0.00"
            step="0.01"
            min="0"
            [attr.data-testid]="'line-amount-' + budgetLine().id"
          />
          <span matTextSuffix>CHF</span>
        </mat-form-field>

        <div class="flex gap-2 justify-end">
          <button
            mat-stroked-button
            (click)="cancelEdit()"
            [attr.data-testid]="'cancel-edit-' + budgetLine().id"
          >
            Annuler
          </button>
          <button
            mat-filled-button
            color="primary"
            (click)="saveEdit()"
            [disabled]="!isValidEdit()"
            [attr.data-testid]="'save-edit-' + budgetLine().id"
          >
            Enregistrer
          </button>
        </div>
      </div>
    } @else {
      <div
        class="flex items-center gap-4 p-4 hover:bg-[color-surface-container-low] rounded-[radius-corner-medium] transition-colors cursor-pointer"
        role="button"
        tabindex="0"
        (click)="startEdit()"
        (keydown.enter)="startEdit()"
        (keydown.space)="startEdit(); $event.preventDefault()"
        [attr.data-testid]="'budget-line-' + budgetLine().id"
      >
        <div class="flex-1">
          <div class="text-body-large">{{ budgetLine().name }}</div>
          <div class="text-label-medium text-[color-on-surface-variant]">
            {{ getRecurrenceLabel(budgetLine().recurrence) }}
          </div>
        </div>
        <div class="text-title-medium font-medium">
          {{ budgetLine().amount | currency: 'CHF' }}
        </div>
        <div class="flex gap-1">
          <button
            mat-icon-button
            (click)="startEdit(); $event.stopPropagation()"
            [attr.aria-label]="'Edit ' + budgetLine().name"
            [attr.data-testid]="'edit-' + budgetLine().id"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            (click)="deleteClicked.emit(); $event.stopPropagation()"
            [attr.aria-label]="'Delete ' + budgetLine().name"
            [attr.data-testid]="'delete-' + budgetLine().id"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetLineItem {
  budgetLine = input.required<BudgetLine>();
  updateClicked = output<BudgetLineUpdate>();
  deleteClicked = output<void>();

  isEditing = signal(false);
  editedLine: { name: string; amount: number } = { name: '', amount: 0 };

  startEdit(): void {
    const line = this.budgetLine();
    this.editedLine = {
      name: line.name,
      amount: line.amount,
    };
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    if (this.isValidEdit()) {
      this.updateClicked.emit({
        name: this.editedLine.name.trim(),
        amount: this.editedLine.amount,
      });
      this.isEditing.set(false);
    }
  }

  isValidEdit(): boolean {
    return this.editedLine.name.trim().length > 0 && this.editedLine.amount > 0;
  }

  getRecurrenceLabel(recurrence: string): string {
    const labels: Record<string, string> = {
      fixed: 'Fixe',
      variable: 'Variable',
      one_off: 'Ponctuel',
    };
    return labels[recurrence] || recurrence;
  }
}
