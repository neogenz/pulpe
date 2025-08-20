import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  QuickAddExpenseForm,
  type TransactionFormData,
} from './quick-add-expense-form';

@Component({
  selector: 'pulpe-add-transaction-dialog',
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
      },
    },
  ],
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    QuickAddExpenseForm,
  ],
  template: `
    <h2
      mat-dialog-title
      class="text-headline-small flex items-center justify-between"
    >
      <span>Ajouter une transaction</span>
      <button matIconButton (click)="close()" aria-label="Fermer la dialog">
        <mat-icon>close</mat-icon>
      </button>
    </h2>

    <mat-dialog-content class="!px-4 !py-3 md:!px-6 md:!py-4">
      <pulpe-quick-add-expense-form
        (addTransaction)="onAddTransaction($event)"
      />
    </mat-dialog-content>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-dialog-content {
      min-width: 280px;

      @media (min-width: 640px) {
        min-width: 320px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionDialog {
  private readonly dialogRef = inject(MatDialogRef<AddTransactionDialog>);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onAddTransaction(transaction: TransactionFormData): void {
    this.dialogRef.close(transaction);
  }
}
