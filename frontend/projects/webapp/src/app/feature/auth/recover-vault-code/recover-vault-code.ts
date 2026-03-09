import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { isApiError } from '@core/api/api-error';
import { VAULT_CODE_LENGTH, VAULT_CODE_VALIDATORS } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import {
  createFieldsMatchValidator,
  recoveryKeyValidators,
  formatRecoveryKeyInput,
} from '@core/validators';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';

@Component({
  selector: 'pulpe-recover-vault-code',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
    ErrorAlert,
    LoadingButton,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isRedirecting()) {
      <div
        class="pulpe-entry-card w-full max-w-md"
        data-testid="recover-vault-code-redirecting"
      >
        <div
          class="flex flex-col items-center justify-center py-12 gap-6"
          role="status"
          aria-live="polite"
        >
          <mat-progress-spinner
            mode="indeterminate"
            [diameter]="40"
            aria-label="Redirection en cours"
          />
          <p class="text-body-large text-on-surface-variant animate-pulse">
            {{ 'auth.recoverVaultCode.redirecting' | transloco }}
          </p>
        </div>
      </div>
    } @else {
      <div
        class="pulpe-entry-card w-full max-w-md"
        data-testid="recover-vault-code-page"
      >
        <button
          matButton
          [routerLink]="['/', ROUTES.ENTER_VAULT_CODE]"
          class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
        >
          <mat-icon class="text-lg">arrow_back</mat-icon>
          <span>{{ 'common.back' | transloco }}</span>
        </button>

        <div class="text-center mb-8">
          <mat-icon class="text-6xl! w-auto! h-auto! text-primary"
            >key</mat-icon
          >
          <h1
            class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
          >
            {{ 'auth.recoverVaultCode.title' | transloco }}
          </h1>
          <p class="text-body-large text-on-surface-variant">
            {{ 'auth.recoverVaultCode.subtitle' | transloco }}
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="recover-vault-code-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'auth.recoverVaultCode.recoveryKeyLabel' | transloco
            }}</mat-label>
            <input
              matInput
              formControlName="recoveryKey"
              data-testid="recovery-key-input"
              (input)="onRecoveryKeyInput()"
              placeholder="XXXX-XXXX-XXXX-XXXX-..."
              class="font-mono text-sm uppercase tracking-wide"
              autocomplete="off"
              spellcheck="false"
            />
            <mat-icon matPrefix>key</mat-icon>
            @if (
              form.get('recoveryKey')?.invalid &&
              form.get('recoveryKey')?.touched
            ) {
              <mat-error>
                @if (form.get('recoveryKey')?.hasError('required')) {
                  {{ 'auth.recoverVaultCode.recoveryKeyRequired' | transloco }}
                } @else if (form.get('recoveryKey')?.hasError('pattern')) {
                  {{
                    'auth.recoverVaultCode.recoveryKeyInvalidFormat' | transloco
                  }}
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'auth.recoverVaultCode.newPinLabel' | transloco
            }}</mat-label>
            <input
              matInput
              [type]="isVaultCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              [attr.maxlength]="VAULT_CODE_LENGTH"
              formControlName="newVaultCode"
              data-testid="new-vault-code-input"
              (input)="clearError()"
              [placeholder]="
                'auth.recoverVaultCode.newPinPlaceholder' | transloco
              "
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isVaultCodeHidden.set(!isVaultCodeHidden())"
              [attr.aria-label]="'form.showPassword' | transloco"
              [attr.aria-pressed]="!isVaultCodeHidden()"
            >
              <mat-icon>{{
                isVaultCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>{{ 'auth.vaultCode.pinHint' | transloco }}</mat-hint>
            @if (
              form.get('newVaultCode')?.invalid &&
              form.get('newVaultCode')?.touched
            ) {
              <mat-error>
                @if (form.get('newVaultCode')?.hasError('required')) {
                  {{ 'auth.recoverVaultCode.newPinRequired' | transloco }}
                } @else if (form.get('newVaultCode')?.hasError('minlength')) {
                  {{ 'auth.vaultCode.pinLength' | transloco }}
                } @else if (form.get('newVaultCode')?.hasError('pattern')) {
                  {{ 'auth.vaultCode.pinPattern' | transloco }}
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>{{
              'auth.recoverVaultCode.confirmPinLabel' | transloco
            }}</mat-label>
            <input
              matInput
              [type]="isConfirmCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              [attr.maxlength]="VAULT_CODE_LENGTH"
              formControlName="confirmCode"
              data-testid="confirm-vault-code-input"
              (input)="clearError()"
              [placeholder]="
                'auth.recoverVaultCode.confirmPinPlaceholder' | transloco
              "
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmCodeHidden.set(!isConfirmCodeHidden())"
              [attr.aria-label]="'form.showPassword' | transloco"
              [attr.aria-pressed]="!isConfirmCodeHidden()"
            >
              <mat-icon>{{
                isConfirmCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              form.get('confirmCode')?.invalid &&
              form.get('confirmCode')?.touched
            ) {
              <mat-error>
                @if (form.get('confirmCode')?.hasError('required')) {
                  {{ 'auth.recoverVaultCode.confirmPinRequired' | transloco }}
                } @else if (
                  form.get('confirmCode')?.hasError('fieldsMismatch')
                ) {
                  {{ 'auth.recoverVaultCode.pinsMismatch' | transloco }}
                }
              </mat-error>
            }
          </mat-form-field>

          <div class="flex items-center">
            <mat-checkbox
              formControlName="rememberDevice"
              data-testid="remember-device-checkbox"
            >
              <span class="text-body-medium text-on-surface">
                {{ 'auth.vaultCode.rememberDevice' | transloco }}
              </span>
            </mat-checkbox>
          </div>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            [loadingText]="'auth.recoverVaultCode.submitting' | transloco"
            icon="lock_reset"
            testId="recover-vault-code-submit-button"
          >
            <span class="ml-2">{{
              'auth.recoverVaultCode.submit' | transloco
            }}</span>
          </pulpe-loading-button>
        </form>
      </div>
    }
  `,
})
export default class RecoverVaultCode {
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #snackBar = inject(MatSnackBar);
  readonly #logger = inject(Logger);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;
  protected readonly isSubmitting = signal(false);
  protected readonly isRedirecting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isVaultCodeHidden = signal(true);
  protected readonly isConfirmCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      recoveryKey: ['', recoveryKeyValidators],
      newVaultCode: ['', VAULT_CODE_VALIDATORS],
      confirmCode: ['', [Validators.required]],
      rememberDevice: [false],
    },
    {
      validators: createFieldsMatchValidator(
        'newVaultCode',
        'confirmCode',
        'fieldsMismatch',
      ),
    },
  );

  readonly #formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  protected onRecoveryKeyInput(): void {
    const raw = this.form.controls.recoveryKey.value;
    const formatted = formatRecoveryKeyInput(raw);

    if (formatted !== raw) {
      this.form.controls.recoveryKey.setValue(formatted, { emitEvent: false });
    }
    this.clearError();
  }

  protected clearError(): void {
    this.errorMessage.set('');
  }

  protected async onSubmit(): Promise<void> {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.form.disable();
    this.clearError();

    const { recoveryKey, newVaultCode, rememberDevice } =
      this.form.getRawValue();

    try {
      // 1. Get current salt and derive new client key
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const newClientKeyHex = await deriveClientKey(
        newVaultCode,
        salt,
        kdfIterations,
      );

      // 2. Recover encryption: unwrap DEK with recovery key, rekey with new client key.
      await firstValueFrom(
        this.#encryptionApi.recover$(recoveryKey.trim(), newClientKeyHex),
      );

      // 3. Store new client key for subsequent requests
      this.#clientKeyService.setDirectKey(newClientKeyHex, rememberDevice);

      // 4. Generate and show new recovery key
      await this.#showNewRecoveryKey();

      // 5. Redirect to dashboard
      this.isRedirecting.set(true);
      const navigated = await this.#router.navigate(['/', ROUTES.DASHBOARD]);

      if (!navigated) {
        this.isRedirecting.set(false);
        this.errorMessage.set(
          this.#transloco.translate('auth.vaultCode.redirectFailed'),
        );
      }
    } catch (error) {
      this.#logger.error('Recover vault code failed:', error);

      if (
        (error instanceof HttpErrorResponse && error.status === 429) ||
        (isApiError(error) && error.status === 429)
      ) {
        this.errorMessage.set(
          this.#transloco.translate('auth.vaultCode.rateLimited'),
        );
      } else if (
        (error instanceof HttpErrorResponse && error.status === 400) ||
        (isApiError(error) && error.status === 400)
      ) {
        this.errorMessage.set(
          this.#transloco.translate('auth.vaultCode.invalidRecoveryKey'),
        );
      } else {
        this.errorMessage.set(
          this.#transloco.translate('common.somethingWentWrong'),
        );
      }
    } finally {
      this.isRedirecting.set(false);
      this.form.enable();
      this.isSubmitting.set(false);
    }
  }

  async #showNewRecoveryKey(): Promise<void> {
    try {
      const { recoveryKey } = await firstValueFrom(
        this.#encryptionApi.regenerateRecoveryKey$(),
      );

      const dialogData: RecoveryKeyDialogData = { recoveryKey };
      const dialogRef = this.#dialog.open(RecoveryKeyDialog, {
        data: dialogData,
        width: '480px',
        disableClose: true,
      });

      await firstValueFrom(dialogRef.afterClosed());
    } catch (error) {
      this.#logger.warn(
        'Recovery key setup failed after vault code recovery — user can generate later from settings',
        error,
      );
      this.#snackBar.open(
        this.#transloco.translate(
          'auth.recoverVaultCode.recoveryKeyGenerationFailed',
        ),
        'OK',
        { duration: 8000, horizontalPosition: 'center' },
      );
    }
  }
}
