import {
  ChangeDetectionStrategy,
  Component,
  inject,
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

export type CreateAllocatedTransactionDialogData =
  CreateAllocatedTransactionFormData;

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

    <mat-dialog-actions align="end">
      <button matButton (click)="cancel()" data-testid="cancel-transaction">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        (click)="submit()"
        [disabled]="!form.canSubmit()"
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

  cancel(): void {
    this.#dialogRef.close();
  }

  submit(): void {
    void this.form().submit();
  }

  onCreated(tx: TransactionCreate): void {
    this.#dialogRef.close(tx);
  }
}
