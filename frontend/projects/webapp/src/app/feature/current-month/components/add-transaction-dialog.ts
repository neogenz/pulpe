import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { LoadingButton } from '@ui/loading-button/loading-button';
import {
  AddTransactionForm,
  type TransactionFormData,
} from './add-transaction-form';

@Component({
  selector: 'pulpe-add-transaction-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslocoPipe,
    AddTransactionForm,
    LoadingButton,
  ],
  template: `
    <div mat-dialog-title class="!flex items-center justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-headline-small text-on-surface m-0 [text-wrap:balance]">
          {{ 'currentMonth.addTransactionTitle' | transloco }}
        </h2>
        <p
          class="text-body-small text-on-surface-variant mt-0.5 mb-0 text-pretty"
        >
          {{ 'currentMonth.addTransactionSubtitle' | transloco }}
        </p>
      </div>
      <button
        matIconButton
        (click)="close()"
        [attr.aria-label]="'currentMonth.addTransactionClose' | transloco"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <pulpe-add-transaction-form
        #form
        class="add-transaction-form-wide block pt-2"
        (created)="onCreated($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton
        (click)="close()"
        data-testid="transaction-cancel-button"
      >
        {{ 'currentMonth.addTransactionCancel' | transloco }}
      </button>
      <pulpe-loading-button
        class="min-w-40"
        type="button"
        [fullWidth]="false"
        [loading]="form.isSubmitting()"
        [disabled]="!form.canSubmit()"
        [loadingText]="'common.loading' | transloco"
        (click)="submit()"
        testId="transaction-submit-button"
      >
        {{ 'currentMonth.addTransactionSubmit' | transloco }}
      </pulpe-loading-button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTransactionDialog {
  readonly #dialogRef = inject(
    MatDialogRef<AddTransactionDialog, TransactionFormData>,
  );
  @ViewChild(AddTransactionForm)
  private form?: AddTransactionForm;

  constructor() {
    this.#dialogRef.afterOpened().subscribe(() => {
      this.form?.focusAmount();
    });
  }

  protected close(): void {
    this.#dialogRef.close();
  }

  protected submit(): void {
    void this.form?.submit();
  }

  protected onCreated(tx: TransactionFormData): void {
    this.#dialogRef.close(tx);
  }
}
