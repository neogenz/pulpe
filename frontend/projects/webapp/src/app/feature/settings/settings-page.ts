import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  type MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@core/logging/logger';
import { UserSettingsApi } from '@core/user-settings';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { DemoModeService } from '@core/demo/demo-mode.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@ui/dialogs/confirmation-dialog';
import { PAY_DAY_MAX } from 'pulpe-shared';

@Component({
  selector: 'pulpe-settings-page',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  styles: `
    .mat-mdc-card-content {
      padding: 16px;
    }
  `,
  template: `
    <div class="max-w-2xl mx-auto" data-testid="settings-page">
      <h1 class="text-headline-medium mb-6">Paramètres</h1>

      <mat-card appearance="outlined" class="mb-6">
        <mat-card-header>
          <div
            mat-card-avatar
            class="flex items-center justify-center bg-primary-container rounded-full"
          >
            <mat-icon class="text-on-primary-container!"
              >calendar_today</mat-icon
            >
          </div>
          <mat-card-title>Jour de paie</mat-card-title>
          <mat-card-subtitle>
            Ton budget commence le jour où tu reçois ton salaire
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>Jour de paie</mat-label>
            <mat-select
              data-testid="pay-day-select"
              [value]="selectedPayDay()"
              (selectionChange)="onPayDayChange($event)"
            >
              <mat-option [value]="null"> 1er du mois </mat-option>
              @for (day of availableDays; track day) {
                <mat-option [value]="day"> Le {{ day }} </mat-option>
              }
            </mat-select>
            <mat-hint data-testid="pay-day-hint">
              @if (selectedPayDay(); as day) {
                @if (day > 28) {
                  Ton budget commence le {{ day }}. Si le mois a moins de jours,
                  il débutera le dernier jour disponible.
                } @else {
                  Ton budget commence le {{ day }} de chaque mois
                }
              } @else {
                Ton budget suit le calendrier standard
              }
            </mat-hint>
          </mat-form-field>
        </mat-card-content>

        @if (hasChanges()) {
          <mat-card-actions class="gap-2">
            <button
              matButton
              color="warn"
              data-testid="cancel-settings-button"
              [disabled]="isSaving()"
              (click)="resetChanges()"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              color="primary"
              data-testid="save-settings-button"
              [disabled]="isSaving()"
              (click)="saveSettings()"
            >
              @if (isSaving()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              Enregistrer
            </button>
          </mat-card-actions>
        }
      </mat-card>

      <!-- Info card about pay day -->
      <mat-card appearance="outlined" class="bg-secondary-container! mb-6">
        <mat-card-content class="flex! gap-4">
          <div class="flex items-center justify-center">
            <mat-icon class="text-on-secondary-container!">lightbulb</mat-icon>
          </div>
          <div class="flex-1">
            <p class="text-body-medium text-on-secondary-container font-medium">
              Comment ça marche ?
            </p>
            <p class="text-body-small text-on-secondary-container mt-1">
              Si tu es payé le 27, ton budget de janvier couvrira la période du
              27 décembre au 26 janvier. Tu planifies ainsi tes dépenses selon
              ton vrai rythme financier.
            </p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Danger zone - hidden in demo mode -->
      @if (!isDemoMode()) {
        <mat-card
          appearance="outlined"
          class="bg-error-container! border-error!"
        >
          <mat-card-content>
            <p class="text-title-medium text-on-error-container font-medium">
              Zone de danger
            </p>
            <p class="text-body-medium text-on-error-container mt-1">
              La suppression de ton compte est définitive. Tu perdras l'accès à
              toutes tes données après un délai de 3 jours.
            </p>
            <button
              matButton="filled"
              color="warn"
              class="mt-4"
              data-testid="delete-account-button"
              [disabled]="isDeleting()"
              (click)="onDeleteAccount()"
            >
              @if (isDeleting()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              Supprimer mon compte
            </button>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  readonly #logger = inject(Logger);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #snackBar = inject(MatSnackBar);
  readonly #dialog = inject(MatDialog);
  readonly #router = inject(Router);
  readonly #authSession = inject(AuthSessionService);
  readonly #demoMode = inject(DemoModeService);

  readonly isDemoMode = this.#demoMode.isDemoMode;
  readonly isSaving = signal(false);
  readonly isDeleting = signal(false);
  readonly availableDays = Array.from({ length: PAY_DAY_MAX }, (_, i) => i + 1);

  // linkedSignal syncs with API value but can be locally modified by user
  readonly selectedPayDay = linkedSignal(
    () => this.#userSettingsApi.payDayOfMonth() ?? null,
  );

  readonly initialValue = computed(() => this.#userSettingsApi.payDayOfMonth());

  readonly hasChanges = computed(() => {
    return this.initialValue() !== this.selectedPayDay();
  });

  onPayDayChange(event: MatSelectChange): void {
    this.selectedPayDay.set(event.value);
  }

  async saveSettings(): Promise<void> {
    if (this.isSaving()) return;

    try {
      this.isSaving.set(true);

      await this.#userSettingsApi.updateSettings({
        payDayOfMonth: this.selectedPayDay(),
      });

      this.#snackBar.open("C'est enregistré", 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch (error) {
      this.#logger.error('Failed to save settings', error);
      this.#snackBar.open("L'enregistrement a échoué — on réessaie ?", 'OK', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  resetChanges(): void {
    this.selectedPayDay.set(this.initialValue());
  }

  async onDeleteAccount(): Promise<void> {
    const dialogData: ConfirmationDialogData = {
      title: 'Supprimer ton compte ?',
      message:
        'Tu perdras immédiatement accès à ton compte. ' +
        'Toutes tes données seront supprimées définitivement après 3 jours.',
      confirmText: 'Supprimer mon compte',
      cancelText: 'Annuler',
      confirmColor: 'warn',
      destructive: true,
    };

    const dialogRef = this.#dialog.open(ConfirmationDialog, {
      data: dialogData,
      width: '400px',
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      this.isDeleting.set(true);
      await this.#userSettingsApi.deleteAccount();
    } catch (error) {
      this.#logger.error('Failed to delete account', error);
      const message = this.#getDeleteAccountErrorMessage(error);
      this.#snackBar.open(message, 'OK', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      return;
    } finally {
      this.isDeleting.set(false);
    }

    // Deletion succeeded - sign out and redirect (errors here are non-critical)
    try {
      await this.#authSession.signOut();
    } catch (error) {
      // Ignore signOut errors but log them - account is already scheduled for deletion
      this.#logger.warn(
        'Sign out failed after account deletion scheduling',
        error,
      );
    }
    await this.#router.navigate(['/login']);
  }

  #getDeleteAccountErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      // Check network error first (status 0 means no response received)
      if (error.status === 0) {
        return 'Erreur réseau — vérifie ta connexion';
      }

      const errorCode = error.error?.code;
      if (errorCode === 'ERR_USER_ACCOUNT_BLOCKED') {
        return 'Ton compte est déjà programmé pour suppression';
      }
    }

    return 'La suppression a échoué — réessaie plus tard';
  }
}
