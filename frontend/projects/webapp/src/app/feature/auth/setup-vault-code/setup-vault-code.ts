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

import { AuthSessionService } from '@core/auth';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-md bg-surface rounded-3xl p-8 flex flex-col shadow-xl"
        data-testid="setup-vault-code-page"
      >
        <div class="text-center mb-8">
          <mat-icon class="text-6xl text-primary mb-4">lock</mat-icon>
          <h1
            class="text-2xl md:text-4xl font-bold text-on-surface mb-2 leading-tight"
          >
            Crée ton code coffre-fort
          </h1>
          <p class="text-base md:text-lg text-on-surface-variant">
            Ce code protège tes données financières. Pulpe ne peut pas le
            retrouver pour toi.
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="setup-vault-code-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Code coffre-fort</mat-label>
            <input
              matInput
              [type]="isCodeHidden() ? 'password' : 'text'"
              formControlName="vaultCode"
              data-testid="vault-code-input"
              (input)="clearError()"
              placeholder="Ton code secret"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isCodeHidden.set(!isCodeHidden())"
              [attr.aria-label]="'Afficher le code'"
              [attr.aria-pressed]="!isCodeHidden()"
            >
              <mat-icon>{{
                isCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>8 caractères minimum</mat-hint>
            @if (
              form.get('vaultCode')?.invalid && form.get('vaultCode')?.touched
            ) {
              <mat-error>
                @if (form.get('vaultCode')?.hasError('required')) {
                  Ton code coffre-fort est nécessaire
                } @else if (form.get('vaultCode')?.hasError('minlength')) {
                  8 caractères minimum
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Confirmer le code</mat-label>
            <input
              matInput
              [type]="isConfirmCodeHidden() ? 'password' : 'text'"
              formControlName="confirmCode"
              data-testid="confirm-vault-code-input"
              (input)="clearError()"
              placeholder="Confirme ton code"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmCodeHidden.set(!isConfirmCodeHidden())"
              [attr.aria-label]="'Afficher le code'"
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
                  Confirme ton code
                } @else if (
                  form.get('confirmCode')?.hasError('fieldsMismatch')
                ) {
                  Les codes ne correspondent pas
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
                Ne plus me demander sur cet appareil
              </span>
            </mat-checkbox>
          </div>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            loadingText="Configuration..."
            icon="arrow_forward"
            testId="setup-vault-code-submit-button"
          >
            <span class="ml-2">Continuer</span>
          </pulpe-loading-button>
        </form>
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

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCodeHidden = signal(true);
  protected readonly isConfirmCodeHidden = signal(true);

  // Migration mode: existing email/password user whose data is keyed to their password.
  // The password-derived key is already in ClientKeyService from signIn.
  protected readonly isMigrationMode = computed(() =>
    this.#clientKeyService.hasClientKey(),
  );

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      vaultCode: ['', [Validators.required, Validators.minLength(8)]],
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

      // 2. Migration: rekey data from password-derived key to vault-code-derived key.
      //    The old key is sent automatically via X-Client-Key interceptor.
      if (this.isMigrationMode()) {
        await firstValueFrom(
          this.#encryptionApi.notifyPasswordChange$(clientKeyHex),
        );
      }

      // 3. Store new client key (replaces old password-derived key in migration)
      this.#clientKeyService.setDirectKey(clientKeyHex, rememberDevice);

      // 4. Setup recovery key (must succeed before marking configured)
      await this.#showRecoveryKey();

      // 5. Mark user as configured only after recovery key is saved
      await this.#authSession
        .getClient()
        .auth.updateUser({ data: { vaultCodeConfigured: true } });

      // 6. Redirect to dashboard
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Setup vault code failed:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
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
}
