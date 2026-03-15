import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  AuthSessionService,
  VAULT_CODE_LENGTH,
  VAULT_CODE_VALIDATORS,
} from '@core/auth';
import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { ROUTES } from '@core/routing/routes-constants';
import { createFieldsMatchValidator } from '@core/validators';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import { LogoutDialog } from '@ui/dialogs/logout-dialog';
import { PostHogService } from '@core/analytics';

@Component({
  selector: 'pulpe-setup-vault-code',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    ErrorAlert,
    LoadingButton,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pulpe-entry-card w-full max-w-md"
      data-testid="setup-vault-code-page"
    >
      <div class="text-center mb-8">
        <mat-icon class="text-6xl! w-auto! h-auto! text-primary">lock</mat-icon>
        <h1
          class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
        >
          {{ 'auth.vaultCode.setupTitle' | transloco }}
        </h1>
        <p class="text-body-large text-on-surface-variant">
          {{ 'auth.vaultCode.setupSubtitle' | transloco }}
        </p>
      </div>

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="space-y-4"
        data-testid="setup-vault-code-form"
      >
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{
            'auth.vaultCode.setupPinLabel' | transloco
          }}</mat-label>
          <input
            matInput
            [type]="isCodeHidden() ? 'password' : 'text'"
            inputmode="numeric"
            [attr.maxlength]="VAULT_CODE_LENGTH"
            formControlName="vaultCode"
            data-testid="vault-code-input"
            (input)="clearError()"
            [placeholder]="'auth.vaultCode.setupPinLabel' | transloco"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isCodeHidden.set(!isCodeHidden())"
            [attr.aria-label]="'form.showPassword' | transloco"
            [attr.aria-pressed]="!isCodeHidden()"
          >
            <mat-icon>{{
              isCodeHidden() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          <mat-hint>{{ 'auth.vaultCode.pinHint' | transloco }}</mat-hint>
          @if (
            form.get('vaultCode')?.invalid && form.get('vaultCode')?.touched
          ) {
            <mat-error>
              @if (form.get('vaultCode')?.hasError('required')) {
                {{ 'auth.vaultCode.pinRequired' | transloco }}
              } @else if (
                form.get('vaultCode')?.hasError('minlength') ||
                form.get('vaultCode')?.hasError('maxlength')
              ) {
                {{ 'auth.vaultCode.pinLength' | transloco }}
              } @else if (form.get('vaultCode')?.hasError('pattern')) {
                {{ 'auth.vaultCode.pinPattern' | transloco }}
              }
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-full mt-4">
          <mat-label>{{
            'auth.vaultCode.confirmPinLabel' | transloco
          }}</mat-label>
          <input
            matInput
            [type]="isConfirmCodeHidden() ? 'password' : 'text'"
            inputmode="numeric"
            [attr.maxlength]="VAULT_CODE_LENGTH"
            formControlName="confirmCode"
            data-testid="confirm-vault-code-input"
            (input)="clearError()"
            [placeholder]="'auth.vaultCode.confirmPinPlaceholder' | transloco"
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
            form.get('confirmCode')?.invalid && form.get('confirmCode')?.touched
          ) {
            <mat-error>
              @if (form.get('confirmCode')?.hasError('required')) {
                {{ 'auth.vaultCode.confirmPinRequired' | transloco }}
              } @else if (form.get('confirmCode')?.hasError('fieldsMismatch')) {
                {{ 'auth.vaultCode.pinsMismatch' | transloco }}
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
          [loadingText]="'auth.vaultCode.setupSubmitting' | transloco"
          icon="arrow_forward"
          testId="setup-vault-code-submit-button"
        >
          <span class="ml-2">{{
            'auth.vaultCode.setupSubmit' | transloco
          }}</span>
        </pulpe-loading-button>
      </form>

      <div class="text-center mt-4 pt-4 border-t border-outline-variant">
        <button
          matButton
          type="button"
          (click)="onLogout()"
          [disabled]="isLoggingOut()"
          data-testid="setup-vault-code-logout-button"
        >
          <mat-icon>logout</mat-icon>
          {{ 'layout.logout' | transloco }}
        </button>
      </div>
    </div>
  `,
})
export default class SetupVaultCode {
  readonly #authSession = inject(AuthSessionService);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #logger = inject(Logger);
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;
  protected readonly isSubmitting = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCodeHidden = signal(true);
  protected readonly isConfirmCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      vaultCode: ['', VAULT_CODE_VALIDATORS],
      confirmCode: ['', [Validators.required]],
      rememberDevice: [false],
    },
    {
      validators: createFieldsMatchValidator(
        'vaultCode',
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

    const { vaultCode, rememberDevice } = this.form.getRawValue();

    try {
      // 1. Get salt and derive client key from vault code
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const clientKeyHex = await deriveClientKey(
        vaultCode,
        salt,
        kdfIterations,
      );

      // 2. Validate key (generates key_check for new users)
      await firstValueFrom(this.#encryptionApi.validateKey$(clientKeyHex));

      // 3. Store new client key
      this.#clientKeyService.setDirectKey(clientKeyHex, rememberDevice);

      // 4. Setup recovery key (must succeed before marking configured)
      await this.#showRecoveryKey();

      // 5. Mark user as configured only after recovery key is saved
      await this.#authSession
        .getClient()
        .auth.updateUser({ data: { vaultCodeConfigured: true } });

      this.#postHogService.captureEvent('vault_code_setup_completed');

      // 6. Redirect to dashboard
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Setup vault code failed:', error);
      this.errorMessage.set(
        this.#transloco.translate('common.somethingWentWrong'),
      );
    } finally {
      this.form.enable();
      this.isSubmitting.set(false);
    }
  }

  async #showRecoveryKey(): Promise<void> {
    const { recoveryKey } = await firstValueFrom(
      this.#encryptionApi.setupRecoveryKey$(),
    );

    const dialogData: RecoveryKeyDialogData = { recoveryKey };
    const dialogRef = this.#dialog.open(RecoveryKeyDialog, {
      data: dialogData,
      width: '480px',
      disableClose: true,
    });

    await firstValueFrom(dialogRef.afterClosed());
  }

  protected async onLogout(): Promise<void> {
    if (this.isLoggingOut()) return;

    this.isLoggingOut.set(true);
    this.#dialog.open(LogoutDialog, { disableClose: true });

    try {
      await this.#authSession.signOut();
    } catch (error) {
      this.#logger.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.isLoggingOut.set(false);
    }

    window.location.href = '/' + ROUTES.LOGIN;
  }
}
