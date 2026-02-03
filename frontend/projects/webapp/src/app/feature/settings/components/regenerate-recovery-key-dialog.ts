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

import { PASSWORD_MIN_LENGTH } from '@core/auth';
import { EncryptionApi, deriveClientKey } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import {
  recoveryKeyValidators,
  formatRecoveryKeyInput,
} from '@core/validators';
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
          <mat-label>Mot de passe</mat-label>
          <input
            matInput
            [type]="isPasswordHidden() ? 'password' : 'text'"
            formControlName="password"
            data-testid="verify-password-input"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isPasswordHidden.set(!isPasswordHidden())"
            [attr.aria-label]="'Afficher le mot de passe'"
            [attr.aria-pressed]="!isPasswordHidden()"
          >
            <mat-icon>{{
              isPasswordHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (verificationForm.get('password')?.hasError('required')) {
            <mat-error>Le mot de passe est requis</mat-error>
          } @else if (verificationForm.get('password')?.hasError('minlength')) {
            <mat-error>Au moins {{ PASSWORD_MIN_LENGTH }} caractères</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Clé de récupération actuelle</mat-label>
          <input
            matInput
            formControlName="currentRecoveryKey"
            data-testid="current-recovery-key-input"
            (input)="onRecoveryKeyInput()"
            placeholder="XXXX-XXXX-XXXX-..."
            class="font-mono uppercase"
          />
          <mat-icon matPrefix>key</mat-icon>
          @if (
            verificationForm.get('currentRecoveryKey')?.hasError('required')
          ) {
            <mat-error>La clé de récupération actuelle est requise</mat-error>
          } @else if (
            verificationForm.get('currentRecoveryKey')?.hasError('pattern')
          ) {
            <mat-error
              >Format invalide — vérifie que tu as bien copié la clé</mat-error
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
  protected readonly isPasswordHidden = signal(true);

  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

  protected readonly verificationForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
      ],
    }),
    currentRecoveryKey: new FormControl('', {
      nonNullable: true,
      validators: recoveryKeyValidators,
    }),
  });

  protected onRecoveryKeyInput(): void {
    const raw = this.verificationForm.controls.currentRecoveryKey.value;
    const formatted = formatRecoveryKeyInput(raw);

    if (formatted !== raw) {
      this.verificationForm.controls.currentRecoveryKey.setValue(formatted, {
        emitEvent: false,
      });
    }
  }

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
