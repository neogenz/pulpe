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

import { VAULT_CODE_MIN_LENGTH } from '@core/auth';
import { EncryptionApi, deriveClientKey } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';

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
    ErrorAlert,
  ],
  template: `
    <h2 mat-dialog-title>Régénérer ma clé</h2>

    <mat-dialog-content>
      <div
        class="bg-error-container rounded-2xl p-4 mb-6 flex gap-3 items-start"
      >
        <mat-icon class="text-on-error-container! shrink-0">warning</mat-icon>
        <div class="space-y-1">
          <p class="text-body-medium text-on-error-container font-medium">
            Attention
          </p>
          <p class="text-body-small text-on-error-container opacity-90">
            Cette action invalide l'ancienne clé. Sans ton code ou ta clé de
            récupération, l'accès à tes données sera définitivement perdu.
          </p>
        </div>
      </div>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="regenerate-key-error"
      />

      <form [formGroup]="verificationForm" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>Code PIN</mat-label>
          <input
            matInput
            [type]="isVaultCodeHidden() ? 'password' : 'text'"
            inputmode="numeric"
            formControlName="vaultCode"
            data-testid="verify-vault-code-input"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isVaultCodeHidden.set(!isVaultCodeHidden())"
            [attr.aria-label]="'Afficher le code PIN'"
            [attr.aria-pressed]="!isVaultCodeHidden()"
          >
            <mat-icon>{{
              isVaultCodeHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (verificationForm.get('vaultCode')?.hasError('required')) {
            <mat-error>Le code PIN est requis</mat-error>
          } @else if (
            verificationForm.get('vaultCode')?.hasError('minlength')
          ) {
            <mat-error
              >Au moins {{ VAULT_CODE_MIN_LENGTH }} caractères</mat-error
            >
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
  protected readonly isVaultCodeHidden = signal(true);
  protected readonly VAULT_CODE_MIN_LENGTH = VAULT_CODE_MIN_LENGTH;

  protected readonly verificationForm = new FormGroup({
    vaultCode: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(VAULT_CODE_MIN_LENGTH),
      ],
    }),
  });

  protected async onSubmit(): Promise<void> {
    if (this.isSubmitting() || !this.verificationForm.valid) return;

    const { vaultCode } = this.verificationForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const clientKeyHex = await deriveClientKey(
        vaultCode,
        salt,
        kdfIterations,
      );

      await firstValueFrom(this.#encryptionApi.validateKey$(clientKeyHex));
      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error('Recovery key verification failed', error);
      this.errorMessage.set(
        'Code PIN incorrect ou clé de chiffrement invalide',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
