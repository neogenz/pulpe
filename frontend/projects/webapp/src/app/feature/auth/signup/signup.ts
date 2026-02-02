import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';

import { AuthCredentialsService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { PostHogService } from '@core/analytics/posthog';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';
import { GoogleOAuthButton } from '@app/pattern/google-oauth';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { createFieldsMatchValidator } from '@core/validators';

@Component({
  selector: 'pulpe-signup',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatCheckboxModule,
    RouterLink,
    GoogleOAuthButton,
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
      >
        <button
          matButton
          [routerLink]="['/', ROUTES.WELCOME]"
          class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
        >
          <mat-icon class="text-lg">arrow_back</mat-icon>
          <span>Retour à l'accueil</span>
        </button>

        <div class="text-center mb-8 mt-4">
          <h1
            class="text-2xl md:text-4xl font-bold text-on-surface mb-2 leading-tight"
          >
            Prêt en 3 minutes
          </h1>
          <p class="text-base md:text-lg text-on-surface-variant">
            Crée ton espace et vois clair dans tes finances
          </p>
        </div>

        <form
          [formGroup]="signupForm"
          (ngSubmit)="signUp()"
          class="space-y-4"
          data-testid="signup-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Email</mat-label>
            <input
              matInput
              type="email"
              formControlName="email"
              data-testid="email-input"
              (input)="clearMessages()"
              placeholder="ton@email.com"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>email</mat-icon>
            @if (
              signupForm.get('email')?.invalid &&
              signupForm.get('email')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('email')?.hasError('required')) {
                  Ton email est nécessaire pour continuer
                } @else if (signupForm.get('email')?.hasError('email')) {
                  Cette adresse email ne semble pas valide
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Mot de passe</mat-label>
            <input
              matInput
              [type]="isPasswordHidden() ? 'password' : 'text'"
              formControlName="password"
              data-testid="password-input"
              (input)="clearMessages()"
              placeholder="Mot de passe"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="togglePasswordVisibility()"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!isPasswordHidden()"
            >
              <mat-icon>{{
                isPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>8 caractères minimum pour sécuriser ton compte</mat-hint>
            @if (
              signupForm.get('password')?.invalid &&
              signupForm.get('password')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('password')?.hasError('required')) {
                  Ton mot de passe est nécessaire
                } @else if (signupForm.get('password')?.hasError('minlength')) {
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
              (input)="clearMessages()"
              placeholder="Confirmer le mot de passe"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="toggleConfirmPasswordVisibility()"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!isConfirmPasswordHidden()"
            >
              <mat-icon>{{
                isConfirmPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              signupForm.get('confirmPassword')?.invalid &&
              signupForm.get('confirmPassword')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('confirmPassword')?.hasError('required')) {
                  Confirme ton mot de passe
                } @else if (
                  signupForm
                    .get('confirmPassword')
                    ?.hasError('passwordsMismatch')
                ) {
                  Les mots de passe ne correspondent pas
                }
              </mat-error>
            }
          </mat-form-field>

          <div class="pt-2">
            <mat-checkbox
              formControlName="acceptTerms"
              [disabled]="isSubmitting()"
              data-testid="accept-terms-checkbox"
            >
              <span class="text-body-medium">
                J'accepte les
                <a
                  [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
                  target="_blank"
                  class="text-primary underline"
                  (click)="$event.stopPropagation()"
                >
                  Conditions d'Utilisation
                </a>
                et la
                <a
                  [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
                  target="_blank"
                  class="text-primary underline"
                  (click)="$event.stopPropagation()"
                >
                  Politique de Confidentialité
                </a>
              </span>
            </mat-checkbox>
            @if (
              signupForm.get('acceptTerms')?.invalid &&
              signupForm.get('acceptTerms')?.touched
            ) {
              <p class="text-error text-body-small mt-1">
                Accepte les conditions pour continuer
              </p>
            }
          </div>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            loadingText="Création en cours..."
            icon="person_add"
            testId="signup-submit-button"
            class="mt-4"
          >
            <span class="ml-2">Créer mon compte</span>
          </pulpe-loading-button>
        </form>

        <div class="flex items-center gap-4 my-6">
          <mat-divider class="flex-1" />
          <span class="text-body-medium text-on-surface-variant">ou</span>
          <mat-divider class="flex-1" />
        </div>

        <pulpe-google-oauth-button
          testId="google-signup-button"
          (authError)="errorMessage.set($event)"
          (loadingChange)="isSubmitting.set($event)"
        />

        <div class="text-center mt-6">
          <p class="text-body-medium text-on-surface-variant">
            Déjà un compte ?
            <button
              matButton
              color="primary"
              class="ml-1"
              [routerLink]="['/', ROUTES.LOGIN]"
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  `,
})
export default class Signup {
  readonly #authCredentials = inject(AuthCredentialsService);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);
  readonly #formBuilder = inject(FormBuilder);
  readonly #postHogService = inject(PostHogService);

  protected readonly ROUTES = ROUTES;

  protected isPasswordHidden = signal<boolean>(true);
  protected isConfirmPasswordHidden = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');

  protected signupForm = this.#formBuilder.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: createFieldsMatchValidator(
        'password',
        'confirmPassword',
        'passwordsMismatch',
      ),
    },
  );

  protected readonly formStatus = toSignal(this.signupForm.statusChanges, {
    initialValue: this.signupForm.status,
  });

  protected readonly canSubmit = computed(() => {
    const isValid = this.formStatus() === 'VALID';
    const isNotSubmitting = !this.isSubmitting();
    return isValid && isNotSubmitting;
  });

  protected togglePasswordVisibility(): void {
    this.isPasswordHidden.set(!this.isPasswordHidden());
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordHidden.set(!this.isConfirmPasswordHidden());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signUp(): Promise<void> {
    if (!this.signupForm.valid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage.set('Quelques champs à vérifier avant de continuer');
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.signupForm.getRawValue();

    try {
      const result = await this.#authCredentials.signUpWithEmail(
        email,
        password,
      );

      if (result.success) {
        this.#postHogService.captureEvent('signup_completed', {
          method: 'email',
        });
        // Guard redirects to setup-vault-code where recovery key is set up
        this.#router.navigate(['/', ROUTES.DASHBOARD]);
      } else {
        this.errorMessage.set(
          result.error || 'La création du compte a échoué — on réessaie ?',
        );
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la création du compte:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
