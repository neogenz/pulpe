import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
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
import { TranslocoPipe } from '@jsverse/transloco';
import {
  EditTransactionForm,
  type HideableField,
} from './edit-transaction-form';
import { type Transaction, type TransactionUpdate } from 'pulpe-shared';

export interface EditTransactionDialogData {
  transaction: Transaction;
  hiddenFields?: HideableField[];
  minDate?: Date;
  maxDate?: Date;
  /**
   * PUL-329 QA fix — the dialog submits itself and awaits the verdict; it
   * closes only on `null` (success). A refusal (e.g. 422 insufficient
   * balance) returns the localized reason and the dialog stays open with the
   * typed values intact.
   */
  submit: (update: TransactionUpdate) => Promise<string | null>;
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
    TranslocoPipe,
    EditTransactionForm,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{ 'transactionForm.editTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <pulpe-edit-transaction-form
        #editForm
        class="block pt-4"
        [transaction]="data.transaction"
        [hiddenFields]="data.hiddenFields ?? []"
        [minDateInput]="data.minDate"
        [maxDateInput]="data.maxDate"
        (updateTransaction)="onUpdateTransaction($event)"
        (cancelEdit)="closeDialog()"
        role="main"
        [attr.aria-label]="'transactionForm.editFormAriaLabel' | transloco"
      />
    </mat-dialog-content>

    @if (submitError(); as error) {
      <p role="alert" class="text-error text-body-small px-6 pb-2">
        {{ error }}
      </p>
    }

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton="outlined"
        type="button"
        (click)="closeDialog()"
        [disabled]="editForm.isUpdating() || isSubmitting()"
        [attr.aria-label]="'transactionForm.cancelAriaLabel' | transloco"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        type="button"
        [disabled]="!editForm.canSubmit() || isSubmitting()"
        (click)="submitForm()"
        [attr.aria-label]="'transactionForm.saveAriaLabel' | transloco"
      >
        <mat-icon aria-hidden="true">
          {{
            editForm.isUpdating() || isSubmitting() ? 'hourglass_empty' : 'save'
          }}
        </mat-icon>
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditTransactionDialog {
  readonly #dialogRef = inject(
    MatDialogRef<EditTransactionDialog, TransactionUpdate>,
  );
  protected readonly data = inject<EditTransactionDialogData>(MAT_DIALOG_DATA);
  protected readonly editForm =
    viewChild.required<EditTransactionForm>('editForm');

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected closeDialog(): void {
    this.#dialogRef.close();
  }

  protected submitForm(): void {
    const form = this.editForm();
    if (form.canSubmit()) {
      form.onSubmit();
    }
  }

  protected async onUpdateTransaction(
    transactionData: TransactionUpdate,
  ): Promise<void> {
    // Re-entry guard mirrors runFormSubmit: a second submit arriving before
    // the disabled button re-renders is dropped.
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.submitError.set(null);
    try {
      const error = await this.data.submit(transactionData);
      if (error) {
        this.submitError.set(error);
        return;
      }
      this.#dialogRef.close(transactionData);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
