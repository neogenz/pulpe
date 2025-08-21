import {
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
} from '@angular/core';
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
    <h2 mat-dialog-title class="text-headline-small">
      Modifier la transaction
    </h2>

    <mat-dialog-content>
      <pulpe-edit-transaction-form
        #editForm
        class="block pt-4"
        [transaction]="data.transaction"
        (updateTransaction)="onUpdateTransaction($event)"
        (cancelEdit)="closeDialog()"
        role="main"
        aria-label="Formulaire de modification de transaction"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-3">
      <button
        matButton="outlined"
        type="button"
        (click)="closeDialog()"
        [disabled]="editForm.isUpdating()"
        aria-label="Annuler la modification"
      >
        Annuler
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="editForm.transactionForm.invalid || editForm.isUpdating()"
        (click)="submitForm()"
        aria-label="Enregistrer les modifications"
      >
        <mat-icon aria-hidden="true">
          {{ editForm.isUpdating() ? 'hourglass_empty' : 'save' }}
        </mat-icon>
        Enregistrer
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTransactionDialog {
  readonly #dialogRef = inject(MatDialogRef<EditTransactionDialog>);
  protected readonly data = inject<EditTransactionDialogData>(MAT_DIALOG_DATA);
  protected readonly editForm =
    viewChild.required<EditTransactionForm>('editForm');

  protected closeDialog(): void {
    this.#dialogRef.close();
  }

  protected submitForm(): void {
    const form = this.editForm();
    if (form.transactionForm.valid && !form.isUpdating()) {
      form.onSubmit();
    }
  }

  protected onUpdateTransaction(
    transactionData: EditTransactionFormData,
  ): void {
    // Note: loading state is managed by the form component
    // It will be reset by the parent component after API call completes
    this.#dialogRef.close(transactionData);
  }
}
