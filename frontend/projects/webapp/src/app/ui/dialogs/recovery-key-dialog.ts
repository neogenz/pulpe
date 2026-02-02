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
  ],
  template: `
    <div data-testid="recovery-key-dialog">
      <h2 mat-dialog-title class="text-headline-small">Ta clé de secours</h2>

      <mat-dialog-content>
        <p class="text-body-medium text-on-surface mb-4">
          Prends un instant pour mettre cette clé en lieu sûr (comme dans un
          gestionnaire de mots de passe). C'est ton unique filet de sécurité :
          si tu oublies ton code de coffre-fort et que tu perds cette clé, tes
          données seront perdues pour toujours. C'est le garant de ta totale
          confidentialité.
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
          <mat-label>Recopie ou colle ta clé pour confirmer</mat-label>
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
          C'est mis en lieu sûr
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
