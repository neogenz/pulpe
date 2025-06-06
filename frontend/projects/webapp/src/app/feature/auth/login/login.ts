import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/auth/auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'pulpe-login',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterModule,
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

        <form (ngSubmit)="signIn()" #loginForm="ngForm" class="space-y-6">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Email</mat-label>
            <input
              matInput
              type="email"
              name="email"
              [ngModel]="emailValue()"
              (ngModelChange)="emailValue.set($event); clearMessages()"
              placeholder="votre@email.com"
              [disabled]="isSubmitting()"
              required
              #emailInput="ngModel"
            />
            <mat-icon matPrefix>email</mat-icon>
            @if (emailInput.invalid && emailInput.touched) {
              <mat-error> Une adresse email valide est requise. </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Mot de passe</mat-label>
            <input
              matInput
              [type]="hidePassword() ? 'password' : 'text'"
              name="password"
              [ngModel]="passwordValue()"
              (ngModelChange)="passwordValue.set($event); clearMessages()"
              placeholder="Mot de passe"
              [disabled]="isSubmitting()"
              required
              minlength="6"
              #passwordInput="ngModel"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="togglePasswordVisibility()"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!hidePassword()"
            >
              <mat-icon>{{
                hidePassword() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (passwordInput.invalid && passwordInput.touched) {
              <mat-error>
                Le mot de passe doit contenir au moins 6 caractères.
              </mat-error>
            }
          </mat-form-field>

          @if (errorMessage()) {
            <div
              class="bg-error-container text-on-error-container p-3 rounded-lg flex items-center gap-2"
            >
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          @if (successMessage()) {
            <div
              class="bg-tertiary-container text-on-tertiary-container p-3 rounded-lg"
            >
              {{ successMessage() }}
            </div>
          }

          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="w-full h-12"
            [disabled]="loginForm.invalid || isSubmitting()"
          >
            @if (isSubmitting()) {
              <div class="flex items-center justify-center">
                <mat-progress-spinner
                  diameter="24"
                  mode="indeterminate"
                ></mat-progress-spinner>
                <span class="ml-2">Connexion en cours...</span>
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
            <a
              routerLink="/onboarding/registration"
              class="text-primary font-medium hover:underline"
            >
              Créer un compte
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export default class Login {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected emailValue = signal<string>('');
  protected passwordValue = signal<string>('');
  protected hidePassword = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  protected canSubmit = computed(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailValid = emailRegex.test(this.emailValue());
    const isPasswordValid = this.passwordValue().length >= 6;
    return isEmailValid && isPasswordValid;
  });

  protected togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  protected clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected async signIn(): Promise<void> {
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    this.clearMessages();

    try {
      const result = await this.authService.signInWithEmail(
        this.emailValue(),
        this.passwordValue(),
      );

      if (result.success) {
        this.successMessage.set('Connexion réussie ! Redirection...');
        // The redirection is handled by the auth state change,
        // so no need for a manual router.navigate here.
      } else {
        this.errorMessage.set(
          result.error || 'Email ou mot de passe incorrect.',
        );
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      this.errorMessage.set(
        "Une erreur inattendue s'est produite. Veuillez réessayer.",
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
