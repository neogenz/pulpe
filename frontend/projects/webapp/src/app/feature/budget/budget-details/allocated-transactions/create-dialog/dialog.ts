import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { type TransactionCreate } from 'pulpe-shared';

import {
  CreateAllocatedTransactionForm,
  type CreateAllocatedTransactionFormData,
} from './form';

export interface CreateAllocatedTransactionDialogData extends CreateAllocatedTransactionFormData {
  /**
   * PUL-329 v2 — la boîte soumet elle-même et attend le verdict ; elle ne se
   * ferme que sur `null` (succès). Un refus (solde d'objectif insuffisant)
   * renvoie sa raison localisée et la saisie reste à l'écran, intacte.
   */
  submit: (transaction: TransactionCreate) => Promise<string | null>;
}

@Component({
  selector: 'pulpe-create-allocated-transaction-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    CreateAllocatedTransactionForm,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      {{
        'budget.newTransactionTitle' | transloco: { name: data.budgetLine.name }
      }}
    </h2>

    <mat-dialog-content>
      <pulpe-create-allocated-transaction-form
        #form
        class="block pt-4"
        [data]="data"
        (created)="onCreated($event)"
      />
    </mat-dialog-content>

    @if (submitError(); as error) {
      <p
        role="alert"
        class="text-error text-body-small px-6 pb-2"
        data-testid="transaction-submit-error"
      >
        {{ error }}
      </p>
    }

    <mat-dialog-actions align="end">
      <button
        matButton
        (click)="cancel()"
        [disabled]="isSubmitting()"
        data-testid="cancel-transaction"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="submit()"
        [disabled]="!form.canSubmit() || isSubmitting()"
        data-testid="save-transaction"
      >
        <mat-icon>add</mat-icon>
        {{ 'budget.transactionCreateButton' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateAllocatedTransactionDialog {
  readonly #dialogRef = inject(
    MatDialogRef<CreateAllocatedTransactionDialog, TransactionCreate>,
  );
  readonly data = inject<CreateAllocatedTransactionDialogData>(MAT_DIALOG_DATA);
  protected readonly form =
    viewChild.required<CreateAllocatedTransactionForm>('form');

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  cancel(): void {
    this.#dialogRef.close();
  }

  submit(): void {
    void this.form().submit();
  }

  async onCreated(tx: TransactionCreate): Promise<void> {
    // Re-entry guard mirrors runFormSubmit: a second submit arriving before
    // the disabled button re-renders is dropped.
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.submitError.set(null);
    try {
      const error = await this.data.submit(tx);
      if (error) {
        this.submitError.set(error);
        return;
      }
      this.#dialogRef.close(tx);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
