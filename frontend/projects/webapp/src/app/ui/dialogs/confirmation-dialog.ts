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
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="text-headline-small">{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="text-body-large text-on-surface">{{ data.message }}</p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="onCancel()">
        {{ data.cancelText || 'Annuler' }}
      </button>
      <button
        matButton="filled"
        [attr.color]="data.confirmColor || 'primary'"
        (click)="onConfirm()"
      >
        {{ data.confirmText || 'Confirmer' }}
      </button>
    </mat-dialog-actions>
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
export class ConfirmationDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);
  readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);

  onConfirm(): void {
    this.#dialogRef.close(true);
  }

  onCancel(): void {
    this.#dialogRef.close(false);
  }
}
