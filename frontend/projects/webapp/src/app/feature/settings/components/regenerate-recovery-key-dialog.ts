import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { EncryptionApi, deriveClientKey } from '@core/encryption';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-regenerate-recovery-key-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small">
      Régénérer ta clé de récupération
    </h2>

    <mat-dialog-content>
      <div
        class="bg-tertiary-container rounded-lg p-4 mb-4 flex gap-3 items-center"
      >
        <mat-icon class="text-on-tertiary-container! shrink-0"
          >warning</mat-icon
        >
        <div>
          <p class="text-body-medium text-on-tertiary-container font-medium">
            Attention
          </p>
          <p class="text-body-small text-on-tertiary-container mt-1">
            Cette action invalide l'ancienne clé. Sans ton code ou ta clé de
            récupération, l'accès à tes données sera définitivement perdu.
          </p>
        </div>
      </div>

      @if (errorMessage(); as error) {
        <p
          class="text-body-medium text-error mb-4"
          data-testid="regenerate-key-error"
        >
          {{ error }}
        </p>
      }

      <form [formGroup]="verificationForm" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Mot de passe</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            data-testid="verify-password-input"
          />
          @if (verificationForm.get('password')?.hasError('required')) {
            <mat-error>Le mot de passe est requis</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Clé de récupération actuelle</mat-label>
          <input
            matInput
            formControlName="currentRecoveryKey"
            data-testid="current-recovery-key-input"
          />
          @if (
            verificationForm.get('currentRecoveryKey')?.hasError('required')
          ) {
            <mat-error>La clé de récupération actuelle est requise</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="cancel-button">
        Annuler
      </button>
      <button
        matButton="filled"
        color="primary"
        data-testid="submit-regenerate-button"
        [disabled]="isSubmitting() || !verificationForm.valid"
        (click)="onSubmit()"
      >
        @if (isSubmitting()) {
          <mat-spinner diameter="20" class="mr-2" />
        }
        Régénérer
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegenerateRecoveryKeyDialog {
  readonly #logger = inject(Logger);
  readonly #dialogRef = inject(MatDialogRef<RegenerateRecoveryKeyDialog>);
  readonly #encryptionApi = inject(EncryptionApi);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly verificationForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    currentRecoveryKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected async onSubmit(): Promise<void> {
    if (this.isSubmitting() || !this.verificationForm.valid) return;

    const { password } = this.verificationForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const clientKeyHex = await deriveClientKey(password, salt, kdfIterations);

      await firstValueFrom(this.#encryptionApi.validateKey$(clientKeyHex));
      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error('Recovery key verification failed', error);
      this.errorMessage.set(
        'Mot de passe incorrect ou clé de chiffrement invalide',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
