import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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

import { isApiError } from '@core/api/api-error';
import { VAULT_CODE_MIN_LENGTH } from '@core/auth';
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
    ErrorAlert,
  ],
  template: `
    <h2 mat-dialog-title class="pb-2!">
      @if (step() === 1) {
        Modifier le code PIN
      } @else {
        Nouveau code PIN
      }
    </h2>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant mb-4">
        @if (step() === 1) {
          Saisis ton code PIN actuel pour confirmer ton identité (au moins
          {{ VAULT_CODE_MIN_LENGTH }} chiffres)
        } @else {
          Choisis ton nouveau code PIN (au moins
          {{ VAULT_CODE_MIN_LENGTH }} chiffres)
        }
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="change-pin-error"
      />

      @if (step() === 1) {
        <form [formGroup]="oldPinForm" (ngSubmit)="onSubmitOldPin()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Code PIN actuel</mat-label>
            <input
              matInput
              [type]="isOldPinHidden() ? 'password' : 'text'"
              inputmode="numeric"
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
                  ? 'Afficher le code PIN'
                  : 'Masquer le code PIN'
              "
              [attr.aria-pressed]="!isOldPinHidden()"
            >
              <mat-icon>{{
                isOldPinHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (oldPinForm.get('oldPin')?.hasError('required')) {
              <mat-error>Ton code PIN est requis</mat-error>
            } @else if (oldPinForm.get('oldPin')?.hasError('minlength')) {
              <mat-error
                >Au moins {{ VAULT_CODE_MIN_LENGTH }} chiffres</mat-error
              >
            } @else if (oldPinForm.get('oldPin')?.hasError('pattern')) {
              <mat-error
                >Le code PIN ne doit contenir que des chiffres</mat-error
              >
            }
          </mat-form-field>
        </form>
      } @else {
        <form [formGroup]="newPinForm" (ngSubmit)="onSubmitNewPin()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nouveau code PIN</mat-label>
            <input
              matInput
              [type]="isNewPinHidden() ? 'password' : 'text'"
              inputmode="numeric"
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
                  ? 'Afficher le code PIN'
                  : 'Masquer le code PIN'
              "
              [attr.aria-pressed]="!isNewPinHidden()"
            >
              <mat-icon>{{
                isNewPinHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (newPinForm.get('newPin')?.hasError('required')) {
              <mat-error>Ton nouveau code PIN est requis</mat-error>
            } @else if (newPinForm.get('newPin')?.hasError('minlength')) {
              <mat-error
                >Au moins {{ VAULT_CODE_MIN_LENGTH }} chiffres</mat-error
              >
            } @else if (newPinForm.get('newPin')?.hasError('pattern')) {
              <mat-error
                >Le code PIN ne doit contenir que des chiffres</mat-error
              >
            }
          </mat-form-field>
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close data-testid="change-pin-cancel-button">
        Annuler
      </button>
      @if (step() === 1) {
        <button
          matButton="filled"
          color="primary"
          data-testid="change-pin-submit-button"
          [disabled]="isSubmitting() || !isOldPinValid()"
          (click)="onSubmitOldPin()"
        >
          @if (isSubmitting()) {
            <mat-spinner diameter="20" class="mr-2" />
          }
          Suivant
        </button>
      } @else {
        <button
          matButton="filled"
          color="primary"
          data-testid="change-pin-submit-button"
          [disabled]="isSubmitting() || !isNewPinValid()"
          (click)="onSubmitNewPin()"
        >
          @if (isSubmitting()) {
            <mat-spinner diameter="20" class="mr-2" />
          }
          Confirmer
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

  protected readonly step = signal<1 | 2>(1);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isOldPinHidden = signal(true);
  protected readonly isNewPinHidden = signal(true);

  #salt = '';
  #kdfIterations = 0;
  #oldClientKey = '';

  protected readonly VAULT_CODE_MIN_LENGTH = VAULT_CODE_MIN_LENGTH;

  protected readonly oldPinForm = new FormGroup({
    oldPin: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(VAULT_CODE_MIN_LENGTH),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });

  protected readonly newPinForm = new FormGroup({
    newPin: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(VAULT_CODE_MIN_LENGTH),
        Validators.pattern(/^\d+$/),
      ],
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
        if (error.code === 'ERR_ENCRYPTION_KEY_CHECK_FAILED') {
          this.errorMessage.set('Code PIN incorrect');
          return;
        }
        if (error.status === 429) {
          this.errorMessage.set('Trop de tentatives — réessaie plus tard');
          return;
        }
      }
      this.#logger.error('Failed to fetch salt for PIN change', error);
      this.errorMessage.set('Une erreur est survenue — réessaie plus tard');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async onSubmitNewPin(): Promise<void> {
    if (this.isSubmitting() || !this.newPinForm.valid) return;

    if (!this.#salt || !this.#kdfIterations || !this.#oldClientKey) {
      this.errorMessage.set('Une erreur est survenue — réessaie plus tard');
      this.step.set(1);
      return;
    }

    const { newPin } = this.newPinForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    let newClientKey: string | undefined;

    try {
      newClientKey = await deriveClientKey(
        newPin,
        this.#salt,
        this.#kdfIterations,
      );

      const response = await firstValueFrom(
        this.#encryptionApi.changePin$(this.#oldClientKey, newClientKey),
      );

      const hasLocalKey = !!this.#storage.getString(
        STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
        'local',
      );
      this.#clientKeyService.setDirectKey(newClientKey, hasLocalKey);

      this.newPinForm.reset();
      this.#clearSensitiveState();
      this.#dialogRef.close({ recoveryKey: response.recoveryKey });
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === 'ERR_ENCRYPTION_KEY_CHECK_FAILED') {
          this.errorMessage.set('Code PIN actuel incorrect');
          this.#clearSensitiveState();
          this.step.set(1);
          this.oldPinForm.reset();
          return;
        }
        if (error.code === 'ERR_ENCRYPTION_SAME_KEY') {
          this.errorMessage.set(
            "Le nouveau code PIN doit être différent de l'ancien",
          );
          return;
        }
        if (
          error.code === 'ERR_ENCRYPTION_REKEY_PARTIAL_FAILURE' &&
          newClientKey
        ) {
          const hasLocalKey = !!this.#storage.getString(
            STORAGE_KEYS.VAULT_CLIENT_KEY_LOCAL,
            'local',
          );
          this.#clientKeyService.setDirectKey(newClientKey, hasLocalKey);
          this.#clearSensitiveState();
          this.#dialogRef.close({ recoveryKey: null });
          return;
        }
        if (error.status === 429) {
          this.errorMessage.set('Trop de tentatives — réessaie plus tard');
          return;
        }
      }
      this.#clearSensitiveState();
      this.step.set(1);
      this.#logger.error('PIN change failed', error);
      this.errorMessage.set(
        'Le changement de code PIN a échoué — réessaie plus tard',
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
