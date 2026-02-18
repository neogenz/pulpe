import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AuthSessionService, VAULT_CODE_MIN_LENGTH } from '@core/auth';
import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { ROUTES } from '@core/routing/routes-constants';
import { createFieldsMatchValidator } from '@core/validators';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';
import { LogoutDialog } from '@ui/dialogs/logout-dialog';

@Component({
  selector: 'pulpe-setup-vault-code',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    ErrorAlert,
    LoadingButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pulpe-entry-shell pulpe-gradient">
      <div
        class="pulpe-entry-card w-full max-w-md"
        data-testid="setup-vault-code-page"
      >
        <div class="text-center mb-8">
          <mat-icon class="text-6xl! w-auto! h-auto! text-primary"
            >lock</mat-icon
          >
          <h1
            class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
          >
            Crée ton code PIN
          </h1>
          <p class="text-body-large text-on-surface-variant">
            Ce code protège tes données chiffrées. Garde-le précieusement :
            personne d'autre ne peut y accéder à ta place, et on ne pourra pas
            le retrouver si tu l'oublies.
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="setup-vault-code-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Ton code PIN</mat-label>
            <input
              matInput
              [type]="isCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="vaultCode"
              data-testid="vault-code-input"
              (input)="clearError()"
              placeholder="Ton code PIN"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isCodeHidden.set(!isCodeHidden())"
              [attr.aria-label]="'Afficher le code PIN'"
              [attr.aria-pressed]="!isCodeHidden()"
            >
              <mat-icon>{{
                isCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>4 chiffres minimum (6+ recommandé)</mat-hint>
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

          <mat-form-field appearance="outline" class="w-full mt-4">
            <mat-label>Confirmer le code</mat-label>
            <input
              matInput
              [type]="isConfirmCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="confirmCode"
              data-testid="confirm-vault-code-input"
              (input)="clearError()"
              placeholder="Confirme ton code"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isConfirmCodeHidden.set(!isConfirmCodeHidden())"
              [attr.aria-label]="'Afficher le code'"
              [attr.aria-pressed]="!isConfirmCodeHidden()"
            >
              <mat-icon>{{
                isConfirmCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (
              form.get('confirmCode')?.invalid &&
              form.get('confirmCode')?.touched
            ) {
              <mat-error>
                @if (form.get('confirmCode')?.hasError('required')) {
                  Confirme ton code
                } @else if (
                  form.get('confirmCode')?.hasError('fieldsMismatch')
                ) {
                  Les deux codes ne sont pas identiques — réessaie
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
            loadingText="On prépare ton espace..."
            icon="arrow_forward"
            testId="setup-vault-code-submit-button"
          >
            <span class="ml-2">Créer mon code PIN</span>
          </pulpe-loading-button>
        </form>

        <div class="text-center mt-4 pt-4 border-t border-outline-variant">
          <button
            matButton
            type="button"
            (click)="onLogout()"
            [disabled]="isLoggingOut()"
            data-testid="setup-vault-code-logout-button"
          >
            <mat-icon>logout</mat-icon>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  `,
})
export default class SetupVaultCode {
  readonly #authSession = inject(AuthSessionService);
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isCodeHidden = signal(true);
  protected readonly isConfirmCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      vaultCode: [
        '',
        [
          Validators.required,
          Validators.minLength(VAULT_CODE_MIN_LENGTH),
          Validators.pattern(/^\d+$/),
        ],
      ],
      confirmCode: ['', [Validators.required]],
      rememberDevice: [false],
    },
    {
      validators: createFieldsMatchValidator(
        'vaultCode',
        'confirmCode',
        'fieldsMismatch',
      ),
    },
  );

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

    const { vaultCode, rememberDevice } = this.form.getRawValue();

    try {
      // 1. Get salt and derive client key from vault code
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const clientKeyHex = await deriveClientKey(
        vaultCode,
        salt,
        kdfIterations,
      );

      // 2. Validate key (generates key_check for new users)
      await firstValueFrom(this.#encryptionApi.validateKey$(clientKeyHex));

      // 3. Store new client key
      this.#clientKeyService.setDirectKey(clientKeyHex, rememberDevice);

      // 4. Setup recovery key (must succeed before marking configured)
      await this.#showRecoveryKey();

      // 5. Mark user as configured only after recovery key is saved
      await this.#authSession
        .getClient()
        .auth.updateUser({ data: { vaultCodeConfigured: true } });

      // 6. Redirect to dashboard
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Setup vault code failed:', error);
      this.errorMessage.set("Quelque chose n'a pas fonctionné — réessaie");
    } finally {
      this.form.enable();
      this.isSubmitting.set(false);
    }
  }

  async #showRecoveryKey(): Promise<void> {
    const { recoveryKey } = await firstValueFrom(
      this.#encryptionApi.setupRecoveryKey$(),
    );

    const dialogData: RecoveryKeyDialogData = { recoveryKey };
    const dialogRef = this.#dialog.open(RecoveryKeyDialog, {
      data: dialogData,
      width: '480px',
      disableClose: true,
    });

    await firstValueFrom(dialogRef.afterClosed());
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
