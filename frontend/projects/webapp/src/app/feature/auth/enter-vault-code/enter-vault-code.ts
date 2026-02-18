import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { firstValueFrom } from 'rxjs';

import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { isApiError } from '@core/api/api-error';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { VAULT_CODE_MIN_LENGTH } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { LogoutDialog } from '@ui/dialogs/logout-dialog';

@Component({
  selector: 'pulpe-enter-vault-code',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    RouterLink,
    ErrorAlert,
    LoadingButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-md"
        data-testid="enter-vault-code-page"
      >
        <div class="text-center mb-8">
          <mat-icon class="text-6xl! w-auto! h-auto! text-primary"
            >lock_open</mat-icon
          >
          <h1
            class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
          >
            Saisis ton code PIN
          </h1>
          <p class="text-body-large text-on-surface-variant">
            Entre ton code pour accéder à tes données.
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="enter-vault-code-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Code PIN</mat-label>
            <input
              matInput
              [type]="isCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="vaultCode"
              data-testid="vault-code-input"
              (input)="clearError()"
              placeholder="Code PIN"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isCodeHidden.set(!isCodeHidden())"
              [attr.aria-label]="'Afficher le code'"
              [attr.aria-pressed]="!isCodeHidden()"
            >
              <mat-icon>{{
                isCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              form.get('vaultCode')?.invalid && form.get('vaultCode')?.touched
            ) {
              <mat-error>
                @if (form.get('vaultCode')?.hasError('required')) {
                  Ton code PIN est nécessaire
                } @else if (form.get('vaultCode')?.hasError('minlength')) {
                  4 chiffres minimum
                } @else if (form.get('vaultCode')?.hasError('pattern')) {
                  Le code PIN ne doit contenir que des chiffres
                }
              </mat-error>
            }
          </mat-form-field>

          <div class="flex items-center">
            <mat-checkbox
              formControlName="rememberDevice"
              data-testid="remember-device-checkbox"
            >
              <span class="text-body-medium text-on-surface">
                Ne plus me demander sur cet appareil
              </span>
            </mat-checkbox>
          </div>

          <pulpe-error-alert [message]="errorMessage()" />

          <pulpe-loading-button
            [loading]="isSubmitting()"
            [disabled]="!canSubmit()"
            loadingText="Vérification..."
            icon="arrow_forward"
            testId="enter-vault-code-submit-button"
          >
            <span class="ml-2">Continuer</span>
          </pulpe-loading-button>

          <div class="text-center mt-2">
            <a
              [routerLink]="['/', ROUTES.RECOVER_VAULT_CODE]"
              class="text-body-small text-primary hover:underline"
              data-testid="lost-code-link"
            >
              Code perdu ?
            </a>
          </div>
        </form>

        <div class="text-center mt-4 pt-4 border-t border-outline-variant">
          <button
            matButton
            type="button"
            (click)="onLogout()"
            [disabled]="isLoggingOut()"
            data-testid="vault-code-logout-button"
          >
            <mat-icon>logout</mat-icon>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  `,
})
export default class EnterVaultCode {
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #authSession = inject(AuthSessionService);
  readonly #dialog = inject(MatDialog);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group({
    vaultCode: [
      '',
      [
        Validators.required,
        Validators.minLength(VAULT_CODE_MIN_LENGTH),
        Validators.pattern(/^\d+$/),
      ],
    ],
    rememberDevice: [false],
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
    this.form.disable();
    this.clearError();

    const { vaultCode } = this.form.getRawValue();

    try {
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const clientKeyHex = await deriveClientKey(
        vaultCode,
        salt,
        kdfIterations,
      );

      await firstValueFrom(this.#encryptionApi.validateKey$(clientKeyHex));

      const rememberDevice = this.form.getRawValue().rememberDevice;
      this.#clientKeyService.setDirectKey(clientKeyHex, rememberDevice);

      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Enter vault code failed:', error);

      if (
        (error instanceof HttpErrorResponse && error.status === 429) ||
        (isApiError(error) && error.status === 429)
      ) {
        this.errorMessage.set('Trop de tentatives, patiente quelques minutes');
      } else if (
        (error instanceof HttpErrorResponse && error.status === 400) ||
        (isApiError(error) && error.status === 400)
      ) {
        this.errorMessage.set(
          'Ce code ne semble pas correct — vérifie et réessaie',
        );
      } else {
        this.errorMessage.set(
          "Quelque chose n'a pas fonctionné — réessaie plus tard",
        );
      }
    } finally {
      this.form.enable();
      this.isSubmitting.set(false);
    }
  }

  protected async onLogout(): Promise<void> {
    if (this.isLoggingOut()) return;

    this.isLoggingOut.set(true);
    this.#dialog.open(LogoutDialog, { disableClose: true });

    try {
      await this.#authSession.signOut();
    } catch (error) {
      this.#logger.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.isLoggingOut.set(false);
    }

    window.location.href = '/' + ROUTES.LOGIN;
  }
}
