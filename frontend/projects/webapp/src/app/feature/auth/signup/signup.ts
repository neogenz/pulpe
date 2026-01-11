import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { AuthApi } from '@core/auth/auth-api';
import { Logger } from '@core/logging/logger';
import { ROUTES } from '@core/routing/routes-constants';

function passwordsMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value as string;
  const confirmPassword = control.get('confirmPassword')?.value as string;

  if (!password || !confirmPassword) {
    return null;
  }

  if (password !== confirmPassword) {
    control.get('confirmPassword')?.setErrors({ passwordsMismatch: true });
    return { passwordsMismatch: true };
  }

  return null;
}

@Component({
  selector: 'pulpe-signup',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen pulpe-gradient flex items-center justify-center p-4"
    >
      <div
        class="w-full max-w-md bg-surface rounded-2xl p-8 flex flex-col shadow-lg"
      >
        <div class="text-center mb-8">
          <h1 class="text-headline-large text-on-surface mb-2">
            Créer un compte
          </h1>
          <p class="text-body-large text-on-surface-variant">
            Rejoins Pulpe pour gérer ton budget
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
              placeholder="votre@email.com"
              [disabled]="isSubmitting()"
            />
            <mat-icon matPrefix>email</mat-icon>
            @if (
              signupForm.get('email')?.invalid &&
              signupForm.get('email')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('email')?.hasError('required')) {
                  L'email est requis.
                } @else if (signupForm.get('email')?.hasError('email')) {
                  Une adresse email valide est requise.
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Mot de passe</mat-label>
            <input
              matInput
              [type]="hidePassword() ? 'password' : 'text'"
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
              [attr.aria-pressed]="!hidePassword()"
            >
              <mat-icon>{{
                hidePassword() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>Minimum 8 caractères</mat-hint>
            @if (
              signupForm.get('password')?.invalid &&
              signupForm.get('password')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('password')?.hasError('required')) {
                  Le mot de passe est requis.
                } @else if (signupForm.get('password')?.hasError('minlength')) {
                  Le mot de passe doit contenir au moins 8 caractères.
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
              [attr.aria-pressed]="!hideConfirmPassword()"
            >
              <mat-icon>{{
                hideConfirmPassword() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              signupForm.get('confirmPassword')?.invalid &&
              signupForm.get('confirmPassword')?.touched
            ) {
              <mat-error>
                @if (signupForm.get('confirmPassword')?.hasError('required')) {
                  La confirmation est requise.
                } @else if (
                  signupForm
                    .get('confirmPassword')
                    ?.hasError('passwordsMismatch')
                ) {
                  Les mots de passe ne correspondent pas.
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
                Vous devez accepter les conditions pour continuer.
              </p>
            }
          </div>

          @if (errorMessage()) {
            <div
              class="bg-error-container text-on-error-container p-3 rounded-lg flex items-center gap-2"
            >
              <mat-icon class="flex-shrink-0">error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <button
            matButton="filled"
            color="primary"
            type="submit"
            data-testid="signup-submit-button"
            class="w-full h-12 mt-4"
            [disabled]="!canSubmit() || isSubmitting()"
          >
            @if (isSubmitting()) {
              <div class="flex items-center justify-center">
                <mat-progress-spinner
                  mode="indeterminate"
                  [diameter]="24"
                  aria-label="Création en cours"
                  role="progressbar"
                  class="pulpe-loading-indicator pulpe-loading-small mr-2 flex-shrink-0"
                ></mat-progress-spinner>
                <span aria-live="polite">Création en cours...</span>
              </div>
            } @else {
              <div class="flex items-center justify-center">
                <mat-icon>person_add</mat-icon>
                <span class="ml-2">Créer mon compte</span>
              </div>
            }
          </button>
        </form>

        <div class="flex items-center gap-4 my-6">
          <mat-divider class="flex-1" />
          <span class="text-body-medium text-on-surface-variant">ou</span>
          <mat-divider class="flex-1" />
        </div>

        <button
          matButton="outlined"
          type="button"
          data-testid="google-signup-button"
          class="w-full h-12"
          [disabled]="isSubmitting()"
          (click)="signUpWithGoogle()"
        >
          <div class="flex items-center justify-center gap-2">
            <mat-icon svgIcon="google" />
            <span>Continuer avec Google</span>
          </div>
        </button>

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
  readonly #authService = inject(AuthApi);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;

  protected hidePassword = signal<boolean>(true);
  protected hideConfirmPassword = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');

  protected signupForm = new FormGroup(
    {
      email: new FormControl('', {
        validators: [Validators.required, Validators.email],
        nonNullable: true,
      }),
      password: new FormControl('', {
        validators: [Validators.required, Validators.minLength(8)],
        nonNullable: true,
      }),
      confirmPassword: new FormControl('', {
        validators: [Validators.required],
        nonNullable: true,
      }),
      acceptTerms: new FormControl(false, {
        validators: [Validators.requiredTrue],
        nonNullable: true,
      }),
    },
    { validators: passwordsMatchValidator },
  );

  protected formStatus = toSignal(this.signupForm.statusChanges, {
    initialValue: this.signupForm.status,
  });

  protected canSubmit = computed(() => {
    const isValid = this.formStatus() === 'VALID';
    const isNotSubmitting = !this.isSubmitting();
    return isValid && isNotSubmitting;
  });

  protected togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.set(!this.hideConfirmPassword());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signUp(): Promise<void> {
    if (!this.signupForm.valid) {
      this.signupForm.markAllAsTouched();
      this.errorMessage.set(
        'Veuillez corriger les erreurs dans le formulaire.',
      );
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.signupForm.getRawValue();

    try {
      const result = await this.#authService.signUpWithEmail(email, password);

      if (result.success) {
        this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
      } else {
        this.errorMessage.set(
          result.error || 'Erreur lors de la création du compte.',
        );
        this.isSubmitting.set(false);
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la création du compte:', error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
      this.isSubmitting.set(false);
    }
  }

  protected async signUpWithGoogle(): Promise<void> {
    this.isSubmitting.set(true);
    this.clearMessages();

    try {
      const result = await this.#authService.signInWithGoogle();

      if (!result.success) {
        this.errorMessage.set(
          result.error || 'Erreur lors de la connexion avec Google',
        );
        this.isSubmitting.set(false);
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la connexion Google:', error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
      this.isSubmitting.set(false);
    }
  }
}
