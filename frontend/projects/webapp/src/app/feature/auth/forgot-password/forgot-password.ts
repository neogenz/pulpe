import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthSessionService } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';

@Component({
  selector: 'pulpe-forgot-password',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
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
        data-testid="forgot-password-page"
      >
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
            Mot de passe oublié
          </h1>
          <p class="text-base md:text-lg text-on-surface-variant">
            Entre ton email pour recevoir un lien de réinitialisation
          </p>
        </div>

        @if (!isSuccess()) {
          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="space-y-6"
            data-testid="forgot-password-form"
          >
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                data-testid="email-input"
                (input)="clearError()"
                placeholder="ton@email.com"
                [disabled]="isSubmitting()"
              />
              <mat-icon matPrefix>email</mat-icon>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <mat-error>
                  @if (form.get('email')?.hasError('required')) {
                    Ton email est nécessaire pour continuer
                  } @else if (form.get('email')?.hasError('email')) {
                    Cette adresse email ne semble pas valide
                  }
                </mat-error>
              }
            </mat-form-field>

            <pulpe-error-alert [message]="errorMessage()" />

            <pulpe-loading-button
              [loading]="isSubmitting()"
              [disabled]="!canSubmit()"
              loadingText="Envoi en cours..."
              icon="send"
              testId="forgot-password-submit-button"
            >
              <span class="ml-2">Envoyer le lien</span>
            </pulpe-loading-button>
          </form>
        } @else {
          <div
            class="text-center space-y-6"
            data-testid="forgot-password-success"
          >
            <mat-icon class="text-6xl text-primary">mark_email_read</mat-icon>
            <p class="text-body-large text-on-surface">
              Si un compte existe avec cette adresse, tu recevras un email avec
              un lien de réinitialisation.
            </p>
            <p class="text-body-medium text-on-surface-variant">
              Pense à vérifier tes spams si tu ne le vois pas.
            </p>
            <a
              [routerLink]="['/', ROUTES.LOGIN]"
              mat-flat-button
              color="primary"
              class="w-full"
              data-testid="back-to-login-button"
            >
              Retour à la connexion
            </a>
          </div>
        }
      </div>
    </div>
  `,
})
export default class ForgotPassword {
  readonly #authSession = inject(AuthSessionService);
  readonly #formBuilder = inject(FormBuilder);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isSuccess = signal(false);

  protected readonly form = this.#formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

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
    this.clearError();

    const { email } = this.form.getRawValue();

    try {
      const result = await this.#authSession.resetPasswordForEmail(email);

      if (result.success) {
        this.isSuccess.set(true);
      } else {
        this.errorMessage.set(
          result.error || "L'envoi a échoué — réessaie dans quelques instants",
        );
      }
    } catch (error) {
      this.#logger.error('Error sending reset email:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
