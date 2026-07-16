import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import type { BudgetLineSavingsWithdrawalDeleteQuery } from 'pulpe-shared';

export type LinkedDeletionChoice =
  BudgetLineSavingsWithdrawalDeleteQuery['scope'];

export interface LinkedDeletionChoiceDialogData {
  title: string;
  message: string;
  /** e.g. "Garder le revenu de juin" — the repayment-only scope. */
  keepIncomeLabel: string;
  /** e.g. "Tout annuler" — the destructive pair scope. */
  deleteAllLabel: string;
  cancelLabel: string;
}

/**
 * PUL-292 (CA9) — three-way choice for deleting one half of a savings-withdrawal
 * couple. `ConfirmationDialog` is strictly binary, so this is a dedicated dialog
 * (never hijack its `cancelText`). Presentational: the caller passes pre-localized
 * labels and maps the returned scope to the store mutation.
 */
@Component({
  selector: 'pulpe-linked-deletion-choice-dialog',
  host: { 'data-testid': 'linked-deletion-choice-dialog' },
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="text-body-large text-on-surface">{{ data.message }}</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="flex-wrap gap-2">
      <button matButton (click)="cancel()" data-testid="linked-deletion-cancel">
        {{ data.cancelLabel }}
      </button>
      <button
        matButton="outlined"
        (click)="chooseRepayment()"
        data-testid="linked-deletion-keep-income"
      >
        {{ data.keepIncomeLabel }}
      </button>
      <button
        matButton="filled"
        class="delete-all"
        (click)="choosePair()"
        data-testid="linked-deletion-delete-all"
      >
        {{ data.deleteAllLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    .delete-all {
      --mdc-filled-button-container-color: var(--mat-sys-error);
      --mdc-filled-button-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkedDeletionChoiceDialog {
  readonly #dialogRef =
    inject<MatDialogRef<LinkedDeletionChoiceDialog, LinkedDeletionChoice>>(
      MatDialogRef,
    );
  protected readonly data =
    inject<LinkedDeletionChoiceDialogData>(MAT_DIALOG_DATA);

  protected chooseRepayment(): void {
    this.#dialogRef.close('repayment');
  }

  protected choosePair(): void {
    this.#dialogRef.close('pair');
  }

  protected cancel(): void {
    this.#dialogRef.close();
  }
}
