import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import {
  AuthSessionService,
  AuthStateService,
  PASSWORD_MIN_LENGTH,
} from '@core/auth';
import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import {
  createFieldsMatchValidator,
  recoveryKeyValidators,
  formatRecoveryKeyInput,
} from '@core/validators';

@Component({
  selector: 'pulpe-reset-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
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
        data-testid="reset-password-page"
      >
        @if (isCheckingSession()) {
          <div class="flex flex-col items-center gap-4 py-8">
            <mat-spinner diameter="40" />
            <p class="text-body-medium text-on-surface-variant">
              Vérification de ton lien...
            </p>
          </div>
        } @else if (saltFetchError()) {
          <div class="text-center space-y-6" data-testid="salt-fetch-error">
            <mat-icon class="text-6xl text-error">error_outline</mat-icon>
            <h1 class="text-2xl font-bold text-on-surface">
              Erreur de chargement
            </h1>
            <p class="text-body-medium text-on-surface-variant">
              {{ saltFetchError() }}
            </p>
            <a
              [routerLink]="['/', ROUTES.FORGOT_PASSWORD]"
              mat-flat-button
              color="primary"
              class="w-full"
              data-testid="back-to-forgot-password-button"
            >
              Réessayer
            </a>
          </div>
        } @else if (!isSessionValid()) {
          <div class="text-center space-y-6" data-testid="invalid-link-message">
            <mat-icon class="text-6xl text-error">link_off</mat-icon>
            <h1 class="text-2xl font-bold text-on-surface">
              Lien invalide ou expiré
            </h1>
            <p class="text-body-medium text-on-surface-variant">
              Ce lien de réinitialisation n'est plus valide. Demande-en un
              nouveau.
            </p>
            <a
              [routerLink]="['/', ROUTES.FORGOT_PASSWORD]"
              mat-flat-button
              color="primary"
              class="w-full"
              data-testid="back-to-forgot-password-button"
            >
              Demander un nouveau lien
            </a>
          </div>
        } @else {
          <button
            matButton
            [routerLink]="['/', ROUTES.LOGIN]"
            class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
          >
            <mat-icon class="text-lg">arrow_back</mat-icon>
            <span>Retour à la connexion</span>
          </button>

          <div class="text-center mb-8 mt-4">
            <h1
              class="text-2xl md:text-4xl font-bold text-on-surface mb-2 leading-tight"
            >
              Réinitialiser le mot de passe
            </h1>
            <p class="text-base md:text-lg text-on-surface-variant">
              @if (hasVaultCode() || !hasRecoveryKey()) {
                Entre ton nouveau mot de passe
              } @else {
                Entre ta clé de récupération et ton nouveau mot de passe
              }
            </p>
          </div>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-4"
            data-testid="reset-password-form"
          >
            @if (showRecoveryKeyField()) {
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Clé de récupération</mat-label>
                <input
                  matInput
                  formControlName="recoveryKey"
                  data-testid="recovery-key-input"
                  (input)="onRecoveryKeyInput()"
                  placeholder="XXXX-XXXX-XXXX-XXXX-..."
                  class="font-mono text-sm uppercase tracking-wide"
                  autocomplete="off"
                  spellcheck="false"
                  [disabled]="isSubmitting()"
                />
                <mat-icon matPrefix>key</mat-icon>
                @if (
                  form.get('recoveryKey')?.invalid &&
                  form.get('recoveryKey')?.touched
                ) {
                  <mat-error>
                    @if (form.get('recoveryKey')?.hasError('required')) {
                      Ta clé de récupération est nécessaire
                    } @else if (form.get('recoveryKey')?.hasError('pattern')) {
                      Format invalide — vérifie que tu as bien copié la clé
                    }
                  </mat-error>
                }
              </mat-form-field>
            }

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Nouveau mot de passe</mat-label>
              <input
                matInput
                [type]="isPasswordHidden() ? 'password' : 'text'"
                formControlName="newPassword"
                data-testid="new-password-input"
                (input)="clearError()"
                placeholder="Nouveau mot de passe"
                [disabled]="isSubmitting()"
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
              <mat-hint>8 caractères minimum</mat-hint>
              @if (
                form.get('newPassword')?.invalid &&
                form.get('newPassword')?.touched
              ) {
                <mat-error>
                  @if (form.get('newPassword')?.hasError('required')) {
                    Ton nouveau mot de passe est nécessaire
                  } @else if (form.get('newPassword')?.hasError('minlength')) {
                    8 caractères minimum
                  }
                </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Confirmer le mot de passe</mat-label>
              <input
                matInput
                [type]="isConfirmPasswordHidden() ? 'password' : 'text'"
                formControlName="confirmPassword"
                data-testid="confirm-password-input"
                (input)="clearError()"
                placeholder="Confirmer le mot de passe"
                [disabled]="isSubmitting()"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                type="button"
                matIconButton
                matSuffix
                (click)="
                  isConfirmPasswordHidden.set(!isConfirmPasswordHidden())
                "
                [attr.aria-label]="'Afficher le mot de passe'"
                [attr.aria-pressed]="!isConfirmPasswordHidden()"
              >
                <mat-icon>{{
                  isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
                }}</mat-icon>
              </button>
              @if (
                form.get('confirmPassword')?.invalid &&
                form.get('confirmPassword')?.touched
              ) {
                <mat-error>
                  @if (form.get('confirmPassword')?.hasError('required')) {
                    Confirme ton mot de passe
                  } @else if (
                    form.get('confirmPassword')?.hasError('passwordsMismatch')
                  ) {
                    Les mots de passe ne correspondent pas
                  }
                </mat-error>
              }
            </mat-form-field>

            <pulpe-error-alert [message]="errorMessage()" />

            <pulpe-loading-button
              [loading]="isSubmitting()"
              [disabled]="!canSubmit()"
              loadingText="Réinitialisation..."
              icon="lock_reset"
              testId="reset-password-submit-button"
            >
              <span class="ml-2">Réinitialiser le mot de passe</span>
            </pulpe-loading-button>
          </form>
        }
      </div>
    </div>
  `,
})
export default class ResetPassword {
  readonly #authSession = inject(AuthSessionService);
  readonly #authState = inject(AuthStateService);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);

  // Salt info fetched on session valid - includes hasRecoveryKey flag
  readonly #saltInfo = signal<{
    salt: string;
    kdfIterations: number;
    hasRecoveryKey: boolean;
  } | null>(null);
  readonly #isFetchingSalt = signal(false);
  readonly #saltFetchError = signal<string | null>(null);
  protected readonly saltFetchError = this.#saltFetchError.asReadonly();

  protected readonly isCheckingSession = computed(
    () => this.#authState.isLoading() || this.#isFetchingSalt(),
  );
  protected readonly isSessionValid = computed(
    () =>
      !this.#authState.isLoading() &&
      this.#authState.isAuthenticated() &&
      this.#saltInfo() !== null &&
      !this.#saltFetchError(),
  );

  // Vault-code users only need to change their password (no encryption impact).
  protected readonly hasVaultCode = computed(() => {
    const user = this.#authState.authState().user;
    return !!user?.user_metadata?.['vaultCodeConfigured'];
  });

  // Existing users before migration have no recovery key - they need setup flow
  protected readonly hasRecoveryKey = computed(
    () => this.#saltInfo()?.hasRecoveryKey ?? false,
  );

  // Show recovery key field only if user doesn't have vault code BUT has a recovery key
  protected readonly showRecoveryKeyField = computed(
    () => !this.hasVaultCode() && this.hasRecoveryKey(),
  );

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      recoveryKey: ['', recoveryKeyValidators],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: createFieldsMatchValidator(
        'newPassword',
        'confirmPassword',
        'passwordsMismatch',
      ),
    },
  );

  readonly #formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly canSubmit = computed(() => {
    return this.#formStatus() === 'VALID' && !this.isSubmitting();
  });

  constructor() {
    effect(() => {
      if (!this.#authState.isLoading() && !this.#authState.isAuthenticated()) {
        this.#logger.warn(
          'Reset password: no valid session after token exchange',
        );
      }
    });

    // Fetch salt info when session becomes valid to determine hasRecoveryKey
    effect(() => {
      const isAuthenticated = this.#authState.isAuthenticated();
      const isLoading = this.#authState.isLoading();
      const saltInfo = this.#saltInfo();

      if (!isLoading && isAuthenticated && saltInfo === null) {
        this.#fetchSaltInfo();
      }
    });

    // Disable recovery key validators when field is not shown
    effect(() => {
      const showField = this.showRecoveryKeyField();
      const control = this.form.controls.recoveryKey;

      if (showField) {
        control.setValidators(recoveryKeyValidators);
      } else {
        control.clearValidators();
      }
      control.updateValueAndValidity();
    });
  }

  async #fetchSaltInfo(): Promise<void> {
    this.#isFetchingSalt.set(true);
    try {
      const saltInfo = await firstValueFrom(this.#encryptionApi.getSalt$());
      this.#saltInfo.set(saltInfo);
    } catch (error) {
      this.#logger.error('Failed to fetch salt info:', error);
      this.#saltFetchError.set(
        'Impossible de charger les informations de sécurité',
      );
    } finally {
      this.#isFetchingSalt.set(false);
    }
  }

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

    if (this.hasVaultCode()) {
      // User has vault code: simple password reset, no encryption impact
      await this.#resetPasswordSimple();
    } else if (this.hasRecoveryKey()) {
      // User has recovery key: use it to rekey data
      await this.#resetPasswordWithRecovery();
    } else {
      // Existing user without vault code/recovery key: reset password, then setup vault code
      await this.#resetPasswordAndSetupVaultCode();
    }
  }

  // Vault-code users: password change has no encryption impact.
  async #resetPasswordSimple(): Promise<void> {
    this.isSubmitting.set(true);
    this.clearError();

    const { newPassword } = this.form.getRawValue();

    try {
      const passwordResult =
        await this.#authSession.updatePassword(newPassword);
      if (!passwordResult.success) {
        this.errorMessage.set(
          passwordResult.error ||
            'La mise à jour du mot de passe a échoué — réessaie',
        );
        return;
      }

      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Reset password (simple) failed:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Existing users before migration: no vault code or recovery key yet.
  // Reset password, then redirect to setup-vault-code to create their first vault code.
  async #resetPasswordAndSetupVaultCode(): Promise<void> {
    this.isSubmitting.set(true);
    this.clearError();

    const { newPassword } = this.form.getRawValue();

    try {
      const passwordResult =
        await this.#authSession.updatePassword(newPassword);
      if (!passwordResult.success) {
        this.errorMessage.set(
          passwordResult.error ||
            'La mise à jour du mot de passe a échoué — réessaie',
        );
        return;
      }

      // Redirect to setup vault code - user will create their first vault code and recovery key
      this.#router.navigate(['/', ROUTES.SETUP_VAULT_CODE]);
    } catch (error) {
      this.#logger.error('Reset password (setup vault code) failed:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Legacy users with recovery key: need it to rekey data with new password-derived key.
  async #resetPasswordWithRecovery(): Promise<void> {
    this.isSubmitting.set(true);
    this.clearError();

    const { recoveryKey, newPassword } = this.form.getRawValue();

    if (!recoveryKey.trim()) {
      this.errorMessage.set('Ta clé de récupération est nécessaire');
      this.isSubmitting.set(false);
      return;
    }

    const saltInfo = this.#saltInfo();
    if (!saltInfo) {
      this.errorMessage.set(
        'Impossible de charger les informations de chiffrement',
      );
      this.isSubmitting.set(false);
      return;
    }

    try {
      // 1. Use cached salt info and derive new client key
      const { salt, kdfIterations } = saltInfo;
      const newClientKeyHex = await deriveClientKey(
        newPassword,
        salt,
        kdfIterations,
      );

      // 2. Update Supabase password first — if this fails, nothing else changed.
      const passwordResult =
        await this.#authSession.updatePassword(newPassword);
      if (!passwordResult.success) {
        this.errorMessage.set(
          passwordResult.error ||
            'La mise à jour du mot de passe a échoué — réessaie',
        );
        this.isSubmitting.set(false);
        return;
      }

      // 3. Recover encryption: unwrap DEK with recovery key, rekey with new client key.
      await firstValueFrom(
        this.#encryptionApi.recover$(recoveryKey.trim(), newClientKeyHex),
      );

      // 4. Store new client key for subsequent requests
      this.#clientKeyService.setDirectKey(newClientKeyHex);

      // 5. Generate and show new recovery key
      await this.#showNewRecoveryKey();

      // 6. Redirect to dashboard
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Reset password failed:', error);

      if (error instanceof HttpErrorResponse && error.status === 400) {
        this.errorMessage.set(
          'Clé de récupération invalide — vérifie que tu as bien copié la clé',
        );
      } else {
        this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async #showNewRecoveryKey(): Promise<void> {
    try {
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
    } catch (error) {
      this.#logger.warn(
        'Recovery key setup failed after password reset — user can generate later from settings',
        error,
      );
    }
  }
}
