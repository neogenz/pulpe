import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import {
  AuthSessionService,
  AuthStateService,
  PASSWORD_MIN_LENGTH,
  VAULT_CODE_MIN_LENGTH,
} from '@core/auth';
import { EncryptionApi, deriveClientKey } from '@core/encryption';
import { Logger } from '@core/logging/logger';
import { ErrorAlert } from '@ui/error-alert';

@Component({
  selector: 'pulpe-delete-account-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ErrorAlert,
  ],
  template: `
    <div class="flex items-center justify-between pr-2">
      <h2 mat-dialog-title>Supprimer ton compte</h2>
      <button
        matIconButton
        mat-dialog-close
        aria-label="Fermer"
        class="text-outline! shrink-0"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <p class="text-body-medium text-on-surface-variant mb-6">
        Toutes tes données seront supprimées définitivement. Il n'y a pas de
        retour en arrière possible.
      </p>

      <pulpe-error-alert
        [message]="errorMessage()"
        data-testid="delete-account-error"
      />

      @if (isOAuthUser()) {
        <form [formGroup]="vaultCodeForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="w-full mb-2">
            <mat-label>Code PIN</mat-label>
            <input
              matInput
              [type]="isVaultCodeHidden() ? 'password' : 'text'"
              inputmode="numeric"
              formControlName="vaultCode"
              data-testid="delete-confirm-vault-code-input"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isVaultCodeHidden.set(!isVaultCodeHidden())"
              [attr.aria-label]="'Afficher le code PIN'"
              [attr.aria-pressed]="!isVaultCodeHidden()"
            >
              <mat-icon>{{
                isVaultCodeHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (vaultCodeForm.get('vaultCode')?.hasError('required')) {
              <mat-error>Le code PIN est requis</mat-error>
            } @else if (vaultCodeForm.get('vaultCode')?.hasError('minlength')) {
              <mat-error
                >Au moins {{ VAULT_CODE_MIN_LENGTH }} chiffres</mat-error
              >
            } @else if (vaultCodeForm.get('vaultCode')?.hasError('pattern')) {
              <mat-error
                >Le code PIN ne doit contenir que des chiffres</mat-error
              >
            }
          </mat-form-field>
        </form>
      } @else {
        <form [formGroup]="deleteForm" (ngSubmit)="onSubmit()">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Confirme avec ton mot de passe</mat-label>
            <input
              matInput
              [type]="isPasswordHidden() ? 'password' : 'text'"
              formControlName="password"
              data-testid="delete-confirm-password-input"
              placeholder="Ton mot de passe"
            />
            <mat-icon matPrefix>lock</mat-icon>
            <button
              type="button"
              matIconButton
              matSuffix
              (click)="isPasswordHidden.set(!isPasswordHidden())"
              [attr.aria-label]="'Afficher le mot de passe'"
              [attr.aria-pressed]="!isPasswordHidden()"
            >
              <mat-icon>{{
                isPasswordHidden() ? 'visibility_off' : 'visibility'
              }}</mat-icon>
            </button>
            @if (deleteForm.get('password')?.hasError('required')) {
              <mat-error>Le mot de passe est requis</mat-error>
            } @else if (deleteForm.get('password')?.hasError('minlength')) {
              <mat-error
                >Au moins {{ PASSWORD_MIN_LENGTH }} caractères</mat-error
              >
            } @else if (deleteForm.get('password')?.hasError('incorrect')) {
              <mat-error>{{
                deleteForm.get('password')?.getError('incorrect')
              }}</mat-error>
            }
          </mat-form-field>
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button
        matButton="filled"
        color="warn"
        class="w-full py-6! text-title-medium font-bold"
        data-testid="confirm-delete-account-button"
        [disabled]="
          isSubmitting() ||
          (isOAuthUser() ? !vaultCodeForm.valid : !deleteForm.valid)
        "
        (click)="onSubmit()"
      >
        @if (isSubmitting()) {
          <mat-spinner diameter="20" class="mr-2" />
        }
        Supprimer définitivement le compte
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialog {
  readonly #logger = inject(Logger);
  readonly #dialogRef = inject(MatDialogRef<DeleteAccountDialog>);
  readonly #authSession = inject(AuthSessionService);
  readonly #authState = inject(AuthStateService);
  readonly #encryptionApi = inject(EncryptionApi);

  protected readonly isOAuthUser = this.#authState.isOAuthUser;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly isPasswordHidden = signal(true);
  protected readonly isVaultCodeHidden = signal(true);

  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;
  protected readonly VAULT_CODE_MIN_LENGTH = VAULT_CODE_MIN_LENGTH;

  protected readonly deleteForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
      ],
    }),
  });

  protected readonly vaultCodeForm = new FormGroup({
    vaultCode: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(VAULT_CODE_MIN_LENGTH),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });

  protected async onSubmit(): Promise<void> {
    if (this.isOAuthUser()) {
      await this.#submitWithVaultCode();
    } else {
      await this.#submitWithPassword();
    }
  }

  async #submitWithVaultCode(): Promise<void> {
    if (this.isSubmitting() || !this.vaultCodeForm.valid) return;

    const { vaultCode } = this.vaultCodeForm.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set('');

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
      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error(
        'Vault code verification failed for account deletion',
        error,
      );
      this.errorMessage.set(
        'Code PIN incorrect ou clé de chiffrement invalide',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async #submitWithPassword(): Promise<void> {
    const passwordControl = this.deleteForm.get('password');
    passwordControl?.setErrors(null);

    if (this.isSubmitting() || !this.deleteForm.valid) return;

    const { password } = this.deleteForm.getRawValue();

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const verifyResult = await this.#authSession.verifyPassword(password);
      if (!verifyResult.success) {
        const message = verifyResult.error ?? 'Mot de passe incorrect';
        passwordControl?.setErrors({ incorrect: message });
        return;
      }

      this.#dialogRef.close(true);
    } catch (error) {
      this.#logger.error('Account deletion verification failed', error);
      this.errorMessage.set('La vérification a échoué — réessaie plus tard');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
