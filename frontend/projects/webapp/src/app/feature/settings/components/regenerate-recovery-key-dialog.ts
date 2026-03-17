import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { VAULT_CODE_LENGTH, VAULT_CODE_VALIDATORS } from '@core/auth';
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
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'settings.regenerateKeyTitle' | transloco }}</h2>

    <mat-dialog-content>
      <div
        class="bg-error-container rounded-2xl p-4 mb-6 flex gap-3 items-start"
      >
        <mat-icon class="text-on-error-container! shrink-0">warning</mat-icon>
        <div class="space-y-1">
          <p class="text-body-medium text-on-error-container font-medium">
            {{ 'settings.regenerateKeyWarningTitle' | transloco }}
          </p>
          <p class="text-body-small text-on-error-container opacity-90">
            {{ 'settings.regenerateKeyWarning' | transloco }}
          </p>
        </div>
      </div>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="regenerate-key-error"
      />

      <form [formGroup]="verificationForm" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full mb-2">
          <mat-label>{{ 'settings.pinCodeLabel' | transloco }}</mat-label>
          <input
            matInput
            [type]="isVaultCodeHidden() ? 'password' : 'text'"
            inputmode="numeric"
            [attr.maxlength]="VAULT_CODE_LENGTH"
            formControlName="vaultCode"
            data-testid="verify-vault-code-input"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isVaultCodeHidden.set(!isVaultCodeHidden())"
            [attr.aria-label]="showPinLabel"
            [attr.aria-pressed]="!isVaultCodeHidden()"
          >
            <mat-icon>{{
              isVaultCodeHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (verificationForm.get('vaultCode')?.hasError('required')) {
            <mat-error>{{ 'settings.pinCodeRequired' | transloco }}</mat-error>
          } @else if (
            verificationForm.get('vaultCode')?.hasError('minlength') ||
            verificationForm.get('vaultCode')?.hasError('maxlength')
          ) {
            <mat-error>{{
              'settings.pinCodeLength'
                | transloco: { length: VAULT_CODE_LENGTH }
            }}</mat-error>
          } @else if (verificationForm.get('vaultCode')?.hasError('pattern')) {
            <mat-error>{{
              'settings.pinCodeDigitsOnly' | transloco
            }}</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="cancel-button">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        data-testid="submit-regenerate-button"
        [disabled]="isSubmitting() || !verificationForm.valid"
        (click)="onSubmit()"
      >
        <span class="flex items-center justify-center">
          @if (isSubmitting()) {
            <mat-spinner diameter="20" class="mr-2" />
          }
          {{ 'settings.regenerateKeySubmit' | transloco }}
        </span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegenerateRecoveryKeyDialog {
  readonly #logger = inject(Logger);
  readonly #dialogRef = inject(MatDialogRef<RegenerateRecoveryKeyDialog>);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #transloco = inject(TranslocoService);

  protected readonly showPinLabel = this.#transloco.translate(
    'settings.showPinCode',
  );

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isVaultCodeHidden = signal(true);
  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;

  protected readonly verificationForm = new FormGroup({
    vaultCode: new FormControl('', {
      nonNullable: true,
      validators: VAULT_CODE_VALIDATORS,
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
      this.errorMessage.set(this.#transloco.translate('settings.pinIncorrect'));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
