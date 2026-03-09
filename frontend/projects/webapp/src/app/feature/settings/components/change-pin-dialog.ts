import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { API_ERROR_CODES } from 'pulpe-shared';

import { isApiError } from '@core/api/api-error';
import { VAULT_CODE_LENGTH, VAULT_CODE_VALIDATORS } from '@core/auth';
import { EncryptionApi, ClientKeyService } from '@core/encryption';
import { deriveClientKey } from '@core/encryption/crypto.utils';
import { Logger } from '@core/logging/logger';
import { STORAGE_KEYS } from '@core/storage/storage-keys';
import { StorageService } from '@core/storage/storage.service';
import { ErrorAlert } from '@ui/error-alert';

@Component({
  selector: 'pulpe-change-pin-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    ErrorAlert,
  ],
  template: `
    <h2 mat-dialog-title class="pb-2!">
      @if (step() === 1) {
        {{ 'settings.changePin.title' | transloco }}
      } @else {
        {{ 'settings.changePin.titleNewPin' | transloco }}
      }
    </h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant mb-4">
        @if (step() === 1) {
          {{
            'settings.changePin.descriptionStep1'
              | transloco: { length: VAULT_CODE_LENGTH }
          }}
        } @else {
          {{
            'settings.changePin.descriptionStep2'
              | transloco: { length: VAULT_CODE_LENGTH }
          }}
        }
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="change-pin-error"
      />

      @if (step() === 1) {
        <form [formGroup]="oldPinForm" (ngSubmit)="onSubmitOldPin()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'settings.changePin.oldPinLabel' | transloco
            }}</mat-label>
            <input
              matInput
              [type]="isOldPinHidden() ? 'password' : 'text'"
              inputmode="numeric"
              [attr.maxlength]="VAULT_CODE_LENGTH"
              formControlName="oldPin"
              data-testid="change-pin-old-pin-input"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isOldPinHidden.set(!isOldPinHidden())"
              [attr.aria-label]="
                isOldPinHidden()
                  ? ('settings.changePin.showPin' | transloco)
                  : ('settings.changePin.hidePin' | transloco)
              "
              [attr.aria-pressed]="!isOldPinHidden()"
            >
              <mat-icon>{{
                isOldPinHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (oldPinForm.get('oldPin')?.hasError('required')) {
              <mat-error>{{
                'settings.changePin.oldPinRequired' | transloco
              }}</mat-error>
            } @else if (oldPinForm.get('oldPin')?.hasError('minlength')) {
              <mat-error>{{
                'settings.pinCodeLength'
                  | transloco: { length: VAULT_CODE_LENGTH }
              }}</mat-error>
            } @else if (oldPinForm.get('oldPin')?.hasError('pattern')) {
              <mat-error>{{
                'settings.pinCodeDigitsOnly' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        </form>
      } @else {
        <form [formGroup]="newPinForm" (ngSubmit)="onSubmitNewPin()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'settings.changePin.newPinLabel' | transloco
            }}</mat-label>
            <input
              matInput
              [type]="isNewPinHidden() ? 'password' : 'text'"
              inputmode="numeric"
              [attr.maxlength]="VAULT_CODE_LENGTH"
              formControlName="newPin"
              data-testid="change-pin-new-pin-input"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isNewPinHidden.set(!isNewPinHidden())"
              [attr.aria-label]="
                isNewPinHidden()
                  ? ('settings.changePin.showPin' | transloco)
                  : ('settings.changePin.hidePin' | transloco)
              "
              [attr.aria-pressed]="!isNewPinHidden()"
            >
              <mat-icon>{{
                isNewPinHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (newPinForm.get('newPin')?.hasError('required')) {
              <mat-error>{{
                'settings.changePin.newPinRequired' | transloco
              }}</mat-error>
            } @else if (newPinForm.get('newPin')?.hasError('minlength')) {
              <mat-error>{{
                'settings.pinCodeLength'
                  | transloco: { length: VAULT_CODE_LENGTH }
              }}</mat-error>
            } @else if (newPinForm.get('newPin')?.hasError('pattern')) {
              <mat-error>{{
                'settings.pinCodeDigitsOnly' | transloco
              }}</mat-error>
            }
          </mat-form-field>
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="change-pin-cancel-button">
        {{ 'common.cancel' | transloco }}
      </button>
      @if (step() === 1) {
        <button
          matButton="filled"
          color="primary"
          data-testid="change-pin-submit-button"
          [disabled]="isSubmitting() || !isOldPinValid()"
          (click)="onSubmitOldPin()"
        >
          <span class="flex items-center justify-center">
            @if (isSubmitting()) {
              <mat-spinner diameter="20" class="mr-2" />
            }
            {{ 'settings.changePin.next' | transloco }}
          </span>
        </button>
      } @else {
        <button
          matButton="filled"
          color="primary"
          data-testid="change-pin-submit-button"
          [disabled]="isSubmitting() || !isNewPinValid()"
          (click)="onSubmitNewPin()"
        >
          <span class="flex items-center justify-center">
            @if (isSubmitting()) {
              <mat-spinner diameter="20" class="mr-2" />
            }
            {{ 'common.confirm' | transloco }}
          </span>
        </button>
      }
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePinDialog {
  readonly #dialogRef = inject(MatDialogRef<ChangePinDialog>);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);
  readonly #transloco = inject(TranslocoService);

  protected readonly step = signal<1 | 2>(1);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isOldPinHidden = signal(true);
  protected readonly isNewPinHidden = signal(true);

  #salt = '';
  #kdfIterations = 0;
  #oldClientKey = '';

  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;

  protected readonly oldPinForm = new FormGroup({
    oldPin: new FormControl('', {
      nonNullable: true,
      validators: VAULT_CODE_VALIDATORS,
    }),
  });

  protected readonly newPinForm = new FormGroup({
    newPin: new FormControl('', {
      nonNullable: true,
      validators: VAULT_CODE_VALIDATORS,
    }),
  });

  readonly #oldPinChanges = toSignal(this.oldPinForm.valueChanges, {
    initialValue: this.oldPinForm.value,
  });

  readonly #newPinChanges = toSignal(this.newPinForm.valueChanges, {
    initialValue: this.newPinForm.value,
  });

  protected readonly isOldPinValid = computed(() => {
    this.#oldPinChanges();
    return this.oldPinForm.valid;
  });

  protected readonly isNewPinValid = computed(() => {
    this.#newPinChanges();
    return this.newPinForm.valid;
  });

  protected async onSubmitOldPin(): Promise<void> {
    if (this.isSubmitting() || !this.oldPinForm.valid) return;

    const { oldPin } = this.oldPinForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      this.#salt = salt;
      this.#kdfIterations = kdfIterations;
      this.#oldClientKey = await deriveClientKey(oldPin, salt, kdfIterations);
      await firstValueFrom(
        this.#encryptionApi.validateKey$(this.#oldClientKey),
      );
      this.oldPinForm.reset();
      this.step.set(2);
    } catch (error) {
      this.#clearSensitiveState();
      if (isApiError(error)) {
        if (error.code === API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.incorrectPin'),
          );
          return;
        }
        if (error.status === 429) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.rateLimited'),
          );
          return;
        }
      }
      this.#logger.error('Failed to fetch salt for PIN change', error);
      this.errorMessage.set(
        this.#transloco.translate('settings.changePin.genericError'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async onSubmitNewPin(): Promise<void> {
    if (this.isSubmitting() || !this.newPinForm.valid) return;

    if (!this.#salt || !this.#kdfIterations || !this.#oldClientKey) {
      this.errorMessage.set(
        this.#transloco.translate('settings.changePin.genericError'),
      );
      this.step.set(1);
      return;
    }

    const { newPin } = this.newPinForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    let newClientKey: string | undefined;
    const hasLocalKey = !!this.#storage.getString(
      STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
      'local',
    );

    try {
      newClientKey = await deriveClientKey(
        newPin,
        this.#salt,
        this.#kdfIterations,
      );

      const response = await firstValueFrom(
        this.#encryptionApi.changePin$(this.#oldClientKey, newClientKey),
      );

      this.#clientKeyService.setDirectKey(newClientKey, hasLocalKey);

      this.newPinForm.reset();
      this.#clearSensitiveState();
      this.#dialogRef.close({ recoveryKey: response.recoveryKey });
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === API_ERROR_CODES.ENCRYPTION_KEY_CHECK_FAILED) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.incorrectOldPin'),
          );
          this.#clearSensitiveState();
          this.step.set(1);
          this.oldPinForm.reset();
          return;
        }
        if (error.code === API_ERROR_CODES.ENCRYPTION_SAME_KEY) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.samePin'),
          );
          return;
        }
        if (
          error.code === API_ERROR_CODES.ENCRYPTION_REKEY_PARTIAL_FAILURE &&
          newClientKey
        ) {
          this.#clientKeyService.setDirectKey(newClientKey, hasLocalKey);
          this.#clearSensitiveState();
          this.#dialogRef.close({ recoveryKey: null });
          return;
        }
        if (error.code === API_ERROR_CODES.ENCRYPTION_REKEY_FAILED) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.rekeyFailed'),
          );
          return;
        }
        if (error.status === 429) {
          this.errorMessage.set(
            this.#transloco.translate('settings.changePin.rateLimited'),
          );
          return;
        }
      }
      this.#clearSensitiveState();
      this.step.set(1);
      this.#logger.error('PIN change failed', error);
      this.errorMessage.set(
        this.#transloco.translate('settings.changePin.changeFailed'),
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  #clearSensitiveState(): void {
    this.#oldClientKey = '';
    this.#salt = '';
    this.#kdfIterations = 0;
  }
}
