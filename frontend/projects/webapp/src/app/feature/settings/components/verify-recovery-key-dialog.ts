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
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { isApiError } from '@core/api/api-error';
import { isExpectedBusinessApiError } from '@core/api/http-expected-business-noise';
import { EncryptionApi } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import {
  formatRecoveryKeyInput,
  recoveryKeyValidators,
} from '@core/validators';
import { ErrorAlert } from '@ui/error-alert';

@Component({
  selector: 'pulpe-verify-recovery-key-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ErrorAlert,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ 'settings.verifyRecoveryKeyTitle' | transloco }}
    </h2>

    <mat-dialog-content>
      <p class="text-body-small text-on-surface-variant leading-relaxed mb-4">
        {{ 'settings.verifyRecoveryKeyHint' | transloco }}
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="verify-recovery-key-dialog-error"
      />

      <form [formGroup]="verifyRecoveryForm" (ngSubmit)="verifyRecoveryKey()">
        <mat-form-field
          appearance="outline"
          class="w-full"
          subscriptSizing="dynamic"
        >
          <mat-label>{{
            'settings.verifyRecoveryKeyLabel' | transloco
          }}</mat-label>
          <input
            matInput
            formControlName="recoveryKey"
            data-testid="verify-recovery-key-dialog-input"
            autocomplete="off"
            spellcheck="false"
            (input)="formatRecoveryKeyAsUserTypes($event)"
          />
          @if (verifyRecoveryForm.controls.recoveryKey.hasError('pattern')) {
            <mat-error>{{
              'auth.recoverVaultCode.recoveryKeyInvalidFormat' | transloco
            }}</mat-error>
          } @else if (
            verifyRecoveryForm.controls.recoveryKey.hasError('required')
          ) {
            <mat-error>{{
              'auth.recoverVaultCode.recoveryKeyRequired' | transloco
            }}</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button
        matButton
        mat-dialog-close
        data-testid="verify-recovery-key-dialog-cancel"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        matButton="filled"
        color="primary"
        data-testid="verify-recovery-key-dialog-submit"
        type="button"
        [disabled]="verifyRecoveryForm.invalid || isVerifyingRecoveryKey()"
        (click)="verifyRecoveryKey()"
      >
        <span class="flex items-center justify-center">
          @if (isVerifyingRecoveryKey()) {
            <mat-spinner diameter="20" class="mr-2" />
          }
          {{ 'settings.verifyRecoveryKeySubmit' | transloco }}
        </span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyRecoveryKeyDialog {
  readonly #logger = inject(Logger);
  readonly #dialogRef = inject(MatDialogRef<VerifyRecoveryKeyDialog>);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #apiErrorLocalizer = inject(ApiErrorLocalizer);
  readonly #transloco = inject(TranslocoService);
  readonly #snackBar = inject(MatSnackBar);

  protected readonly verifyRecoveryForm = new FormGroup({
    recoveryKey: new FormControl('', {
      nonNullable: true,
      validators: recoveryKeyValidators,
    }),
  });
  protected readonly isVerifyingRecoveryKey = signal(false);
  protected readonly errorMessage = signal('');

  protected formatRecoveryKeyAsUserTypes(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRecoveryKeyInput(input.value);
    if (formatted !== input.value) {
      this.verifyRecoveryForm.controls.recoveryKey.setValue(formatted, {
        emitEvent: false,
      });
      input.value = formatted;
    }
  }

  protected async verifyRecoveryKey(): Promise<void> {
    if (this.isVerifyingRecoveryKey() || !this.verifyRecoveryForm.valid) {
      return;
    }

    this.errorMessage.set('');
    this.isVerifyingRecoveryKey.set(true);

    const { recoveryKey } = this.verifyRecoveryForm.getRawValue();

    try {
      await firstValueFrom(this.#encryptionApi.verifyRecoveryKey$(recoveryKey));
      this.#snackBar.open(
        this.#transloco.translate('settings.verifyRecoveryKeySuccess'),
        'OK',
        {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        },
      );
      this.#dialogRef.close(true);
    } catch (error) {
      const message = isApiError(error)
        ? this.#apiErrorLocalizer.localizeApiError(error)
        : this.#transloco.translate('apiError.generic');
      this.errorMessage.set(message);
      if (!isExpectedBusinessApiError(error)) {
        this.#logger.error('Recovery key verification failed', error);
      }
    } finally {
      this.isVerifyingRecoveryKey.set(false);
    }
  }
}
