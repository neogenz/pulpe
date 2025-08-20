import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  EditTransactionForm,
  type EditTransactionFormData,
} from './edit-transaction-form';
import { type Transaction } from '@pulpe/shared';

export interface EditTransactionDialogData {
  transaction: Transaction;
  isUpdating?: boolean;
}

@Component({
  selector: 'pulpe-edit-transaction-dialog',
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
    EditTransactionForm,
  ],
  template: `
    <h2
      mat-dialog-title
      class="text-headline-small flex items-center justify-between"
    >
      <span>Modifier la transaction</span>
      <button matIconButton (click)="close()" aria-label="Fermer la dialog">
        <mat-icon>close</mat-icon>
      </button>
    </h2>

    <mat-dialog-content class="!px-4 !py-3 md:!px-6 md:!py-4">
      <pulpe-edit-transaction-form
        [transaction]="data.transaction"
        (updateTransaction)="onUpdateTransaction($event)"
        (cancelEdit)="close()"
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
export class EditTransactionDialog {
  private readonly dialogRef = inject(MatDialogRef<EditTransactionDialog>);
  protected readonly data = inject<EditTransactionDialogData>(MAT_DIALOG_DATA);

  protected close(): void {
    this.dialogRef.close();
  }

  protected onUpdateTransaction(
    transactionData: EditTransactionFormData,
  ): void {
    // Note: loading state is managed by the form component
    // It will be reset by the parent component after API call completes
    this.dialogRef.close(transactionData);
  }
}
