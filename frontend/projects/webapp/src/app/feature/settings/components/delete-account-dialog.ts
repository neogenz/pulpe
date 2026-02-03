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

import { AuthSessionService, PASSWORD_MIN_LENGTH } from '@core/auth';
import { Logger } from '@core/logging/logger';

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
  ],
  template: `
    <div class="flex items-center justify-between pr-2">
      <h2 mat-dialog-title>Supprimer ton compte</h2>
      <button
        mat-icon-button
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

      <form [formGroup]="deleteForm" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Confirme avec ton mot de passe</mat-label>
          <input
            matInput
            [type]="hidePassword() ? 'password' : 'text'"
            formControlName="password"
            data-testid="delete-confirm-password-input"
            placeholder="Ton mot de passe"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="hidePassword.set(!hidePassword())"
            [attr.aria-label]="hidePassword() ? 'Afficher' : 'Masquer'"
            [attr.aria-pressed]="!hidePassword()"
          >
            <mat-icon>{{
              hidePassword() ? 'visibility_off' : 'visibility'
            }}</mat-icon>
          </button>
          @if (deleteForm.get('password')?.hasError('required')) {
            <mat-error>Le mot de passe est requis</mat-error>
          } @else if (deleteForm.get('password')?.hasError('minlength')) {
            <mat-error>Au moins {{ PASSWORD_MIN_LENGTH }} caractères</mat-error>
          } @else if (deleteForm.get('password')?.hasError('incorrect')) {
            <mat-error>{{
              deleteForm.get('password')?.getError('incorrect')
            }}</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button
        matButton="filled"
        color="warn"
        class="w-full py-6! text-title-medium font-bold"
        data-testid="confirm-delete-account-button"
        [disabled]="isSubmitting() || !deleteForm.valid"
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

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly hidePassword = signal(true);

  protected readonly PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

  protected readonly deleteForm = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PASSWORD_MIN_LENGTH),
      ],
    }),
  });

  protected async onSubmit(): Promise<void> {
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
