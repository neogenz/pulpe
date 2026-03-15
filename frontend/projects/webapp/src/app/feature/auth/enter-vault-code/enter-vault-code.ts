import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { isApiError } from '@core/api/api-error';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { VAULT_CODE_LENGTH, VAULT_CODE_VALIDATORS } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LogoutDialog } from '@ui/dialogs/logout-dialog';
import { PostHogService } from '@core/analytics';

@Component({
  selector: 'pulpe-enter-vault-code',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    RouterLink,
    ErrorAlert,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
          {{ 'auth.vaultCode.enterTitle' | transloco }}
        </h1>
        <p class="text-body-large text-on-surface-variant">
          {{ 'auth.vaultCode.enterSubtitle' | transloco }}
        </p>
      </div>

      <!-- ngSubmit kept as keyboard a11y fallback (Enter key); auto-submit fires via valueChanges -->
      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="space-y-4"
        data-testid="enter-vault-code-form"
      >
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>{{ 'auth.vaultCode.pinLabel' | transloco }}</mat-label>
          <input
            matInput
            [type]="isCodeHidden() ? 'password' : 'text'"
            inputmode="numeric"
            [attr.maxlength]="VAULT_CODE_LENGTH"
            formControlName="vaultCode"
            data-testid="vault-code-input"
            (input)="clearError()"
            [placeholder]="'auth.vaultCode.pinLabel' | transloco"
          />
          <mat-icon matPrefix>lock</mat-icon>
          <button
            type="button"
            matIconButton
            matSuffix
            (click)="isCodeHidden.set(!isCodeHidden())"
            [attr.aria-label]="'form.showPassword' | transloco"
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
                {{ 'auth.vaultCode.pinRequired' | transloco }}
              } @else if (
                form.get('vaultCode')?.hasError('minlength') ||
                form.get('vaultCode')?.hasError('maxlength')
              ) {
                {{ 'auth.vaultCode.pinLength' | transloco }}
              } @else if (form.get('vaultCode')?.hasError('pattern')) {
                {{ 'auth.vaultCode.pinPattern' | transloco }}
              }
            </mat-error>
          }
          <mat-hint>{{ 'auth.vaultCode.pinHint' | transloco }}</mat-hint>
        </mat-form-field>

        <div class="flex items-center">
          <mat-checkbox
            formControlName="rememberDevice"
            data-testid="remember-device-checkbox"
          >
            <span class="text-body-medium text-on-surface">
              {{ 'auth.vaultCode.rememberDevice' | transloco }}
            </span>
          </mat-checkbox>
        </div>

        <pulpe-error-alert [message]="errorMessage()" />

        @if (isSubmitting()) {
          <div class="flex justify-center">
            <mat-spinner diameter="24" />
          </div>
        }

        <div class="text-center mt-2">
          <a
            [routerLink]="['/', ROUTES.RECOVER_VAULT_CODE]"
            class="text-body-small text-primary hover:underline"
            data-testid="lost-code-link"
          >
            {{ 'auth.vaultCode.lostCode' | transloco }}
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
          {{ 'layout.logout' | transloco }}
        </button>
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
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;
  protected readonly VAULT_CODE_LENGTH = VAULT_CODE_LENGTH;
  protected readonly isSubmitting = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group({
    vaultCode: ['', VAULT_CODE_VALIDATORS],
    rememberDevice: [false],
  });

  constructor() {
    this.form.controls.vaultCode.valueChanges
      .pipe(
        filter((value) => value.length === VAULT_CODE_LENGTH),
        filter(() => !this.isSubmitting()),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        // valueChanges fires before FormGroup recalculates validity — force sync
        this.form.updateValueAndValidity({ emitEvent: false });
        this.onSubmit();
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

      this.#postHogService.captureEvent('vault_code_entered');
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Enter vault code failed:', error);

      if (
        (error instanceof HttpErrorResponse && error.status === 429) ||
        (isApiError(error) && error.status === 429)
      ) {
        this.errorMessage.set(
          this.#transloco.translate('auth.vaultCode.rateLimited'),
        );
      } else if (
        (error instanceof HttpErrorResponse && error.status === 400) ||
        (isApiError(error) && error.status === 400)
      ) {
        this.errorMessage.set(
          this.#transloco.translate('auth.vaultCode.invalidCode'),
        );
      } else {
        this.errorMessage.set(
          this.#transloco.translate('common.somethingWentWrong'),
        );
      }
      this.form.controls.vaultCode.setValue('', { emitEvent: false });
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
