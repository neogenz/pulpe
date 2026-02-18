import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
  effect,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  AuthSessionService,
  AuthStateService,
  PASSWORD_MIN_LENGTH,
} from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
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
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-md"
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
              class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
            >
              Réinitialiser le mot de passe
            </h1>
            <p class="text-body-large text-on-surface-variant">
              Entre ton nouveau mot de passe
            </p>
          </div>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-4"
            data-testid="reset-password-form"
          >
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
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isPasswordHidden = signal(true);
  protected readonly isConfirmPasswordHidden = signal(true);

  protected readonly isCheckingSession = computed(() =>
    this.#authState.isLoading(),
  );
  protected readonly isSessionValid = computed(
    () => !this.#authState.isLoading() && this.#authState.isAuthenticated(),
  );

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
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
      this.#logger.error('Reset password failed:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
