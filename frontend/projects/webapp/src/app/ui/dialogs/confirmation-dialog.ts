import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'pulpe-confirmation-dialog',
  host: { 'data-testid': 'confirmation-dialog' },
  imports: [MatDialogModule, MatButtonModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title class="ph-no-capture">{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="ph-no-capture text-body-large text-on-surface">
        {{ data.message }}
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="gap-2">
      <button
        matButton
        (click)="onCancel()"
        data-testid="confirmation-cancel-button"
      >
        {{ data.cancelText || ('common.cancel' | transloco) }}
      </button>
      <button
        matButton="filled"
        [class.confirm-warn]="data.confirmColor === 'warn'"
        (click)="onConfirm()"
        data-testid="confirmation-confirm-button"
      >
        {{ data.confirmText || ('common.confirm' | transloco) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }

    .confirm-warn {
      --mdc-filled-button-container-color: var(--mat-sys-error);
      --mdc-filled-button-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  readonly #dialogRef = inject(MatDialogRef<ConfirmationDialog>);
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);

  protected onConfirm(): void {
    this.#dialogRef.close(true);
  }

  protected onCancel(): void {
    this.#dialogRef.close(false);
  }
}
