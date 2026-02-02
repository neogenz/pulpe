import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface RecoveryKeyDialogData {
  recoveryKey: string;
}

@Component({
  selector: 'pulpe-recovery-key-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <div data-testid="recovery-key-dialog">
      <h2 mat-dialog-title class="text-headline-small">Clé de récupération</h2>

      <mat-dialog-content>
        <p class="text-body-medium text-on-surface mb-4">
          Cette clé te permet de récupérer tes données si tu oublies ton mot de
          passe. Note-la dans un endroit sûr — elle ne sera plus affichée.
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
          {{ isCopied() ? 'Copié !' : 'Copier la clé' }}
        </button>

        <mat-form-field
          appearance="outline"
          class="w-full"
          subscriptSizing="dynamic"
        >
          <mat-label>Colle ta clé ici pour confirmer</mat-label>
          <input
            matInput
            data-testid="recovery-key-confirm-input"
            [(ngModel)]="confirmValue"
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
          J'ai bien noté ma clé
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    mat-dialog-content {
      max-width: 480px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryKeyDialog {
  readonly #dialogRef = inject(MatDialogRef<RecoveryKeyDialog>);
  readonly data = inject<RecoveryKeyDialogData>(MAT_DIALOG_DATA);

  readonly isCopied = signal(false);
  protected confirmValue = '';

  isConfirmed(): boolean {
    const normalize = (s: string) =>
      s
        .trim()
        .replace(/[\s-]+/g, '')
        .toUpperCase();
    return normalize(this.confirmValue) === normalize(this.data.recoveryKey);
  }

  async copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.data.recoveryKey);
    this.isCopied.set(true);
  }

  onConfirm(): void {
    this.#dialogRef.close(true);
  }
}
