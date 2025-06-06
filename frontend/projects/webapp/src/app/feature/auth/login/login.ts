import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'pulpe-login',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .login-container {
        min-height: 100vh;
        background: var(--mat-sys-surface-container-low);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .login-card {
        background: var(--mat-sys-surface-container);
        color: var(--mat-sys-on-surface);
        border-radius: var(--mat-sys-corner-large);
        padding: 2rem;
        max-width: 28rem;
        width: 100%;
        box-shadow: var(--mat-sys-elevation-3);
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .login-title {
        font-size: var(--mat-sys-typescale-headline-medium-size);
        font-weight: var(--mat-sys-typescale-headline-medium-weight);
        line-height: var(--mat-sys-typescale-headline-medium-line-height);
        color: var(--mat-sys-on-surface);
        margin: 0 0 0.5rem 0;
      }

      .login-subtitle {
        font-size: var(--mat-sys-typescale-body-medium-size);
        line-height: var(--mat-sys-typescale-body-medium-line-height);
        color: var(--mat-sys-on-surface-variant);
        margin: 0;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .form-field-wrapper {
        width: 100%;
      }

      .message-error {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        border: 1px solid var(--mat-sys-error);
        border-radius: var(--mat-sys-corner-medium);
        padding: 0.75rem 1rem;
      }

      .message-success {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
        border: 1px solid var(--mat-sys-tertiary);
        border-radius: var(--mat-sys-corner-medium);
        padding: 0.75rem 1rem;
      }

      .submit-button {
        width: 100%;
      }

      .login-footer {
        text-align: center;
        margin-top: 1.5rem;
      }

      .footer-text {
        font-size: var(--mat-sys-typescale-body-small-size);
        color: var(--mat-sys-on-surface-variant);
        margin: 0;
      }

      .footer-link {
        color: var(--mat-sys-primary);
        text-decoration: none;
        font-weight: var(--mat-sys-typescale-body-small-weight);
      }

      .footer-link:hover {
        color: var(--mat-sys-primary);
        text-decoration: underline;
      }
    `,
  ],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">Connexion</h1>
          <p class="login-subtitle">
            Entrez votre email pour recevoir un lien de connexion
          </p>
        </div>

        <form (ngSubmit)="sendMagicLink()" class="login-form">
          <div class="form-field-wrapper">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                [value]="emailValue()"
                (input)="onEmailChange($event)"
                placeholder="votre@email.com"
                [disabled]="isSubmitting()"
                required
              />
              <mat-icon matPrefix>email</mat-icon>
            </mat-form-field>
          </div>

          @if (errorMessage()) {
            <div class="message-error">
              {{ errorMessage() }}
            </div>
          }

          @if (successMessage()) {
            <div class="message-success">
              {{ successMessage() }}
            </div>
          }

          <button
            mat-raised-button
            color="primary"
            type="submit"
            class="submit-button"
            [disabled]="!canSubmit() || isSubmitting()"
          >
            @if (isSubmitting()) {
              <mat-icon>hourglass_empty</mat-icon>
              Envoi en cours...
            } @else {
              <mat-icon>send</mat-icon>
              Envoyer le lien magique
            }
          </button>
        </form>

        <div class="login-footer">
          <p class="footer-text">
            Nouveau sur Pulpe ?
            <a href="/onboarding" class="footer-link"> Créer un compte </a>
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
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  protected canSubmit(): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.emailValue());
  }

  protected onEmailChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.emailValue.set(target.value);
    // Clear messages when user types
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  protected async sendMagicLink(): Promise<void> {
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const result = await this.authService.signInWithMagicLink(
        this.emailValue(),
      );

      if (result.success) {
        this.successMessage.set(
          'Un lien de connexion a été envoyé à votre email !',
        );

        // Redirect to magic link sent page after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/auth/magic-link-sent'], {
            queryParams: { email: this.emailValue() },
          });
        }, 2000);
      } else {
        this.errorMessage.set(
          result.error || "Erreur lors de l'envoi du lien de connexion",
        );
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      this.errorMessage.set("Une erreur inattendue s'est produite.");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
