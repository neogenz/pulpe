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
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  ClientKeyService,
  EncryptionApi,
  deriveClientKey,
} from '@core/encryption';
import { isApiError } from '@core/api/api-error';
import { VAULT_CODE_MIN_LENGTH } from '@core/auth';
import { ROUTES } from '@core/routing/routes-constants';
import { Logger } from '@core/logging/logger';
import {
  createFieldsMatchValidator,
  recoveryKeyValidators,
  formatRecoveryKeyInput,
} from '@core/validators';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import {
  RecoveryKeyDialog,
  type RecoveryKeyDialogData,
} from '@ui/dialogs/recovery-key-dialog';

@Component({
  selector: 'pulpe-recover-vault-code',
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
        data-testid="recover-vault-code-page"
      >
        <button
          matButton
          [routerLink]="['/', ROUTES.ENTER_VAULT_CODE]"
          class="flex items-center gap-1 text-body-medium text-on-surface-variant hover:text-primary self-start"
        >
          <mat-icon class="text-lg">arrow_back</mat-icon>
          <span>Retour</span>
        </button>

        <div class="text-center mb-8">
          <mat-icon class="text-6xl! w-auto! h-auto! text-primary"
            >key</mat-icon
          >
          <h1
            class="text-headline-large md:text-display-small font-bold text-on-surface mb-2 leading-tight"
          >
            Récupère ton code PIN
          </h1>
          <p class="text-body-large text-on-surface-variant">
            Entre ta clé de récupération et ton nouveau code
          </p>
        </div>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4"
          data-testid="recover-vault-code-form"
        >
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Clé de récupération</mat-label>
            <input
              matInput
              formControlName="recoveryKey"
              data-testid="recovery-key-input"
              (input)="onRecoveryKeyInput()"
              placeholder="XXXX-XXXX-XXXX-XXXX-..."
              class="font-mono text-sm uppercase tracking-wide"
              autocomplete="off"
              spellcheck="false"
            />
            <mat-icon matPrefix>key</mat-icon>
            @if (
              form.get('recoveryKey')?.invalid &&
              form.get('recoveryKey')?.touched
            ) {
              <mat-error>
                @if (form.get('recoveryKey')?.hasError('required')) {
                  Ta clé de récupération est nécessaire
                } @else if (form.get('recoveryKey')?.hasError('pattern')) {
                  Format invalide — vérifie que tu as bien copié la clé
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Nouveau code PIN</mat-label>
            <input
              matInput
              [type]="isVaultCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="newVaultCode"
              data-testid="new-vault-code-input"
              (input)="clearError()"
              placeholder="Nouveau code PIN"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isVaultCodeHidden.set(!isVaultCodeHidden())"
              [attr.aria-label]="'Afficher le code'"
              [attr.aria-pressed]="!isVaultCodeHidden()"
            >
              <mat-icon>{{
                isVaultCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            <mat-hint>4 chiffres minimum (6+ recommandé)</mat-hint>
            @if (
              form.get('newVaultCode')?.invalid &&
              form.get('newVaultCode')?.touched
            ) {
              <mat-error>
                @if (form.get('newVaultCode')?.hasError('required')) {
                  Ton nouveau code est nécessaire
                } @else if (form.get('newVaultCode')?.hasError('minlength')) {
                  4 chiffres minimum
                } @else if (form.get('newVaultCode')?.hasError('pattern')) {
                  Le code PIN ne doit contenir que des chiffres
                }
              </mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Confirmer le code PIN</mat-label>
            <input
              matInput
              [type]="isConfirmCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="confirmCode"
              data-testid="confirm-vault-code-input"
              (input)="clearError()"
              placeholder="Confirmer le code PIN"
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
                  Les codes ne correspondent pas
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
            loadingText="Récupération..."
            icon="lock_reset"
            testId="recover-vault-code-submit-button"
          >
            <span class="ml-2">Récupérer</span>
          </pulpe-loading-button>
        </form>
      </div>
    </div>
  `,
})
export default class RecoverVaultCode {
  readonly #clientKeyService = inject(ClientKeyService);
  readonly #encryptionApi = inject(EncryptionApi);
  readonly #formBuilder = inject(FormBuilder);
  readonly #router = inject(Router);
  readonly #dialog = inject(MatDialog);
  readonly #logger = inject(Logger);

  protected readonly ROUTES = ROUTES;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isVaultCodeHidden = signal(true);
  protected readonly isConfirmCodeHidden = signal(true);

  protected readonly form = this.#formBuilder.nonNullable.group(
    {
      recoveryKey: ['', recoveryKeyValidators],
      newVaultCode: [
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
        'newVaultCode',
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

  protected onRecoveryKeyInput(): void {
    const raw = this.form.controls.recoveryKey.value;
    const formatted = formatRecoveryKeyInput(raw);

    if (formatted !== raw) {
      this.form.controls.recoveryKey.setValue(formatted, { emitEvent: false });
    }
    this.clearError();
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

    const { recoveryKey, newVaultCode, rememberDevice } =
      this.form.getRawValue();

    try {
      // 1. Get current salt and derive new client key
      const { salt, kdfIterations } = await firstValueFrom(
        this.#encryptionApi.getSalt$(),
      );
      const newClientKeyHex = await deriveClientKey(
        newVaultCode,
        salt,
        kdfIterations,
      );

      // 2. Recover encryption: unwrap DEK with recovery key, rekey with new client key.
      await firstValueFrom(
        this.#encryptionApi.recover$(recoveryKey.trim(), newClientKeyHex),
      );

      // 3. Store new client key for subsequent requests
      this.#clientKeyService.setDirectKey(newClientKeyHex, rememberDevice);

      // 4. Generate and show new recovery key
      await this.#showNewRecoveryKey();

      // 5. Redirect to dashboard
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    } catch (error) {
      this.#logger.error('Recover vault code failed:', error);

      if (
        (error instanceof HttpErrorResponse && error.status === 400) ||
        (isApiError(error) && error.status === 400)
      ) {
        this.errorMessage.set(
          'Clé de récupération invalide — vérifie que tu as bien copié la clé',
        );
      } else {
        this.errorMessage.set("Quelque chose n'a pas fonctionné — réessayons");
      }
    } finally {
      this.form.enable();
      this.isSubmitting.set(false);
    }
  }

  async #showNewRecoveryKey(): Promise<void> {
    try {
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
    } catch (error) {
      this.#logger.warn(
        'Recovery key setup failed after vault code recovery — user can generate later from settings',
        error,
      );
    }
  }
}
