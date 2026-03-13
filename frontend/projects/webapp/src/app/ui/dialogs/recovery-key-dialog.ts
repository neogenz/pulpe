import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

export interface RecoveryKeyDialogData {
  recoveryKey: string;
}

@Component({
  selector: 'pulpe-recovery-key-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
  ],
  host: { 'data-testid': 'recovery-key-dialog' },
  template: `
    <h2 mat-dialog-title>{{ 'recoveryKey.title' | transloco }}</h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface mb-4">
        {{ 'recoveryKey.description' | transloco }}
      </p>

      <div
        class="bg-surface-container rounded-lg p-4 mb-4 font-mono text-body-large text-center select-all break-all"
        data-testid="recovery-key-display"
      >
        {{ data.recoveryKey }}
      </div>

      <button
        matButton
        class="w-full mb-4"
        (click)="copyToClipboard()"
        data-testid="copy-recovery-key-button"
      >
        <mat-icon>content_copy</mat-icon>
        {{
          isCopied()
            ? ('recoveryKey.copied' | transloco)
            : ('recoveryKey.copyKey' | transloco)
        }}
      </button>

      <mat-form-field
        appearance="outline"
        class="w-full"
        subscriptSizing="dynamic"
      >
        <mat-label>{{ 'recoveryKey.confirmLabel' | transloco }}</mat-label>
        <input
          matInput
          data-testid="recovery-key-confirm-input"
          [value]="confirmValue()"
          (input)="confirmValue.set($any($event.target).value)"
        />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton="filled"
        color="primary"
        [disabled]="!isConfirmed()"
        (click)="onConfirm()"
        data-testid="recovery-key-confirm-button"
      >
        {{ 'recoveryKey.confirmed' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryKeyDialog {
  readonly #dialogRef = inject(MatDialogRef<RecoveryKeyDialog>);
  readonly data = inject<RecoveryKeyDialogData>(MAT_DIALOG_DATA);

  protected readonly isCopied = signal(false);
  protected readonly confirmValue = signal('');

  protected readonly isConfirmed = computed(() => {
    const normalize = (s: string) =>
      s
        .trim()
        .replace(/[\s-]+/g, '')
        .toUpperCase();
    return normalize(this.confirmValue()) === normalize(this.data.recoveryKey);
  });

  async copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.data.recoveryKey);
    this.isCopied.set(true);
  }

  onConfirm(): void {
    this.#dialogRef.close(true);
  }
}
