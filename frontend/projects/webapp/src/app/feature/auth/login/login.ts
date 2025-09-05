import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthApi } from '@core/auth/auth-api';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';

@Component({
  selector: 'pulpe-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
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
          <h1 class="text-headline-large text-on-surface mb-2">Connexion</h1>
          <p class="text-body-large text-on-surface-variant">
            Accédez à votre espace personnel
          </p>
        </div>

        <form
          [formGroup]="loginForm"
          (ngSubmit)="signIn()"
          class="space-y-6"
          data-testid="login-form"
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
              loginForm.get('email')?.invalid && loginForm.get('email')?.touched
            ) {
              <mat-error>
                @if (loginForm.get('email')?.hasError('required')) {
                  L'email est requis.
                } @else if (loginForm.get('email')?.hasError('email')) {
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
            @if (
              loginForm.get('password')?.invalid &&
              loginForm.get('password')?.touched
            ) {
              <mat-error>
                @if (loginForm.get('password')?.hasError('required')) {
                  Le mot de passe est requis.
                } @else if (loginForm.get('password')?.hasError('minlength')) {
                  Le mot de passe doit contenir au moins 6 caractères.
                }
              </mat-error>
            }
          </mat-form-field>

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
            data-testid="login-submit-button"
            class="w-full h-12"
            [disabled]="!canSubmit() || isSubmitting()"
          >
            @if (isSubmitting()) {
              <div class="flex items-center justify-center">
                <mat-progress-spinner
                  mode="indeterminate"
                  [diameter]="24"
                  aria-label="Connexion en cours"
                  role="progressbar"
                  class="pulpe-loading-indicator pulpe-loading-small mr-2 flex-shrink-0"
                ></mat-progress-spinner>
                <span aria-live="polite">Connexion en cours...</span>
              </div>
            } @else {
              <div class="flex items-center justify-center">
                <mat-icon>login</mat-icon>
                <span class="ml-2">Se connecter</span>
              </div>
            }
          </button>
        </form>

        <div class="text-center mt-6">
          <p class="text-body-medium text-on-surface-variant">
            Nouveau sur Pulpe ?
            <button
              matButton
              color="primary"
              class="ml-1"
              routerLink="/onboarding/welcome"
            >
              Créer un compte
            </button>
          </p>
        </div>
      </div>
    </div>
  `,
})
export default class Login {
  readonly #authService = inject(AuthApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);

  protected hidePassword = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected loginForm = this.#formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected formStatus = toSignal(this.loginForm.statusChanges, {
    initialValue: this.loginForm.status,
  });

  protected canSubmit = computed(() => {
    const isValid = this.formStatus() === 'VALID';
    const isNotSubmitting = !this.isSubmitting();
    return isValid && isNotSubmitting;
  });

  constructor() {
    // Form validity is now tracked reactively via formStatus signal
  }

  protected togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signIn(): Promise<void> {
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set(
        'Veuillez corriger les erreurs dans le formulaire.',
      );
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.loginForm.value;

    // Explicit null checks for safety
    if (!email || !password) {
      this.errorMessage.set('Email et mot de passe requis.');
      this.isSubmitting.set(false);
      return;
    }

    try {
      const result = await this.#authService.signInWithEmail(email, password);

      if (result.success) {
        this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
      } else {
        this.errorMessage.set(
          result.error || 'Email ou mot de passe incorrect.',
        );
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la connexion:', error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
