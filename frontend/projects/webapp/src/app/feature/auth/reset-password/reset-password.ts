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
import { createFieldsMatchValidator } from '@core/validators';

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
          <a
            [routerLink]="['/', ROUTES.LOGIN]"
            class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
          >
            <mat-icon class="text-lg">arrow_back</mat-icon>
            <span>Retour à la connexion</span>
          </a>

          <div class="text-center mb-8 mt-4">
            <h1
              class="text-2xl md:text-4xl font-bold text-on-surface mb-2 leading-tight"
            >
              Réinitialiser le mot de passe
            </h1>
            <p class="text-base md:text-lg text-on-surface-variant">
              Entre ta clé de récupération et ton nouveau mot de passe
            </p>
          </div>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-4"
            data-testid="reset-password-form"
          >
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Clé de récupération</mat-label>
              <textarea
                matInput
                formControlName="recoveryKey"
                data-testid="recovery-key-input"
                (input)="clearError()"
                placeholder="XXXX-XXXX-XXXX-..."
                rows="3"
                class="font-mono"
                [disabled]="isSubmitting()"
              ></textarea>
              <mat-icon matPrefix>key</mat-icon>
              @if (
                form.get('recoveryKey')?.invalid &&
                form.get('recoveryKey')?.touched
              ) {
                <mat-error> Ta clé de récupération est nécessaire </mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Nouveau mot de passe</mat-label>
              <input
                matInput
                [type]="hidePassword() ? 'password' : 'text'"
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
                (click)="hidePassword.set(!hidePassword())"
                [attr.aria-label]="'Afficher le mot de passe'"
                [attr.aria-pressed]="!hidePassword()"
              >
                <mat-icon>{{
                  hidePassword() ? 'visibility_off' : 'visibility'
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
                [type]="hideConfirmPassword() ? 'password' : 'text'"
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
                (click)="hideConfirmPassword.set(!hideConfirmPassword())"
                [attr.aria-label]="'Afficher le mot de passe'"
                [attr.aria-pressed]="!hideConfirmPassword()"
              >
                <mat-icon>{{
                  hideConfirmPassword() ? 'visibility_off' : 'visibility'
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
  protected readonly isCheckingSession = signal(true);
  protected readonly isSessionValid = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      recoveryKey: ['', [Validators.required]],
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
    // Reactively wait for Supabase to process the URL tokens and establish a session.
    // No arbitrary timeout — the effect fires as soon as isLoading becomes false.
    effect(() => {
      if (!this.#authState.isLoading()) {
        this.isSessionValid.set(this.#authState.isAuthenticated());
        this.isCheckingSession.set(false);

        if (!this.#authState.isAuthenticated()) {
          this.#logger.warn(
            'Reset password: no valid session after token exchange',
          );
        }
      }
    });
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
    this.clearError();

    const { recoveryKey, newPassword } = this.form.getRawValue();

    try {
      // 1. Get current salt and derive new client key
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
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
      //    If this fails, the user can retry — they can still log in with the new password.
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
