import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  /** When true, puts confirm button on left and cancel on right to discourage destructive action */
  destructive?: boolean;
}

@Component({
  selector: 'pulpe-confirmation-dialog',

  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="text-body-large text-on-surface-variant">
        {{ data.message }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (data.destructive) {
        <button
          matButton="filled"
          color="warn"
          (click)="onConfirm()"
          data-testid="confirm-delete-button"
        >
          {{ data.confirmText || 'Confirmer' }}
        </button>
        <button matButton mat-dialog-close data-testid="cancel-delete-button">
          {{ data.cancelText || 'Annuler' }}
        </button>
      } @else {
        <button matButton mat-dialog-close data-testid="cancel-delete-button">
          {{ data.cancelText || 'Annuler' }}
        </button>
        <button
          matButton="filled"
          [color]="data.confirmColor || 'primary'"
          (click)="onConfirm()"
          data-testid="confirm-delete-button"
        >
          {{ data.confirmText || 'Confirmer' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  readonly #dialogRef = inject(MatDialogRef<ConfirmationDialog>);
  readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);

  onConfirm(): void {
    this.#dialogRef.close(true);
  }
}
