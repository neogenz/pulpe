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
  deleteRepaymentLabel: string;
  deletePairLabel: string;
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
      <p class="whitespace-pre-line text-body-large text-on-surface">
        {{ data.message }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions class="choices gap-2">
      <button
        matButton="outlined"
        class="w-full"
        (click)="chooseRepayment()"
        data-testid="linked-deletion-delete-repayment"
      >
        {{ data.deleteRepaymentLabel }}
      </button>
      <button
        matButton="filled"
        class="delete-pair w-full"
        (click)="choosePair()"
        data-testid="linked-deletion-delete-pair"
      >
        {{ data.deletePairLabel }}
      </button>
      <button matButton (click)="cancel()" data-testid="linked-deletion-cancel">
        {{ data.cancelLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    .choices {
      flex-direction: column;
      align-items: stretch;
    }

    .delete-pair {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
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
