import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'pulpe-confirmation-dialog',

  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div data-testid="delete-confirmation-dialog">
      <h2 mat-dialog-title class="text-headline-small">{{ data.title }}</h2>

      <mat-dialog-content>
        <p class="text-body-large text-on-surface">{{ data.message }}</p>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button
          matButton
          (click)="onCancel()"
          data-testid="cancel-delete-button"
        >
          {{ data.cancelText || 'Annuler' }}
        </button>
        <button
          matButton="filled"
          [attr.color]="data.confirmColor || 'primary'"
          (click)="onConfirm()"
          data-testid="confirm-delete-button"
        >
          {{ data.confirmText || 'Confirmer' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      mat-dialog-content {
        max-width: 400px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  readonly #dialogRef = inject(MatDialogRef<ConfirmationDialog>);
  readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);

  onConfirm(): void {
    this.#dialogRef.close(true);
  }

  onCancel(): void {
    this.#dialogRef.close(false);
  }
}
