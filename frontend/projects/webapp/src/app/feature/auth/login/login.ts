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
import { MatDividerModule } from '@angular/material/divider';
import { AuthCredentialsService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { GoogleOAuthButton } from '@app/pattern/google-oauth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-login',

  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
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
        class="w-full max-w-md bg-surface rounded-2xl p-8 flex flex-col shadow-lg"
      >
        <a
          [routerLink]="['/', ROUTES.WELCOME]"
          class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
        >
          <mat-icon class="text-lg">arrow_back</mat-icon>
          <span>Retour à l'accueil</span>
        </a>

        <div class="text-center mb-8 mt-4">
          <h1 class="text-headline-large text-on-surface mb-2">Connexion</h1>
          <p class="text-body-large text-on-surface-variant">
            Retrouve ton espace
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
                  Ton email est nécessaire pour continuer
                } @else if (loginForm.get('email')?.hasError('email')) {
                  Cette adresse email ne semble pas valide
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
                  Ton mot de passe est nécessaire
                } @else if (loginForm.get('password')?.hasError('minlength')) {
                  8 caractères minimum
                }
              </mat-error>
            }
          </mat-form-field>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            loadingText="Connexion..."
            icon="login"
            testId="login-submit-button"
          >
            <span class="ml-2">Se connecter</span>
          </pulpe-loading-button>
        </form>

        <div class="flex items-center gap-4 my-6">
          <mat-divider class="flex-1" />
          <span class="text-body-medium text-on-surface-variant">ou</span>
          <mat-divider class="flex-1" />
        </div>

        <pulpe-google-oauth-button
          testId="google-login-button"
          (authError)="errorMessage.set($event)"
          (loadingChange)="isSubmitting.set($event)"
        />

        <div class="text-center mt-6">
          <p class="text-body-medium text-on-surface-variant">
            Nouveau sur Pulpe ?
            <button
              matButton
              color="primary"
              class="ml-1"
              [routerLink]="['/', ROUTES.SIGNUP]"
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
  readonly #authCredentials = inject(AuthCredentialsService);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected hidePassword = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');

  protected loginForm = this.#formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
    ],
  });

  protected readonly formStatus = toSignal(this.loginForm.statusChanges, {
    initialValue: this.loginForm.status,
  });

  protected readonly canSubmit = computed(() => {
    const isValid = this.formStatus() === 'VALID';
    const isNotSubmitting = !this.isSubmitting();
    return isValid && isNotSubmitting;
  });

  protected togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
  }

  protected async signIn(): Promise<void> {
    if (!this.loginForm.valid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Quelques champs à vérifier avant de continuer');
      return;
    }

    this.isSubmitting.set(true);
    this.clearMessages();

    const { email, password } = this.loginForm.getRawValue();

    try {
      const result = await this.#authCredentials.signInWithEmail(
        email,
        password,
      );

      if (result.success) {
        this.#router.navigate(['/', ROUTES.DASHBOARD]);
      } else {
        this.errorMessage.set(
          result.error || 'Email ou mot de passe incorrect — on réessaie ?',
        );
      }
    } catch (error) {
      this.#logger.error('Erreur lors de la connexion:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
