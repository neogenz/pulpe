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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  type MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Logger } from '@core/logging/logger';
import { UserSettingsApi } from '@core/user-settings';
import { PAY_DAY_MAX } from 'pulpe-shared';

@Component({
  selector: 'pulpe-settings-page',
  imports: [
    MatButtonModule,
    MatCardModule,
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
            Votre budget commence le jour où vous recevez votre salaire
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
                  Votre budget commence le {{ day }}. Si le mois a moins de
                  jours, il débutera le dernier jour disponible.
                } @else {
                  Votre budget commence le {{ day }} de chaque mois
                }
              } @else {
                Votre budget suit le calendrier standard
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
      <mat-card appearance="outlined" class="bg-secondary-container!">
        <mat-card-content class="flex! gap-4">
          <div class="flex items-center justify-center">
            <mat-icon class="text-on-secondary-container!">lightbulb</mat-icon>
          </div>
          <div class="flex-1">
            <p class="text-body-medium text-on-secondary-container font-medium">
              Comment ça marche ?
            </p>
            <p class="text-body-small text-on-secondary-container mt-1">
              Si vous êtes payé le 27, votre budget de janvier couvrira la
              période du 27 décembre au 26 janvier. Vous planifiez ainsi vos
              dépenses selon votre vrai rythme financier.
            </p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  readonly #logger = inject(Logger);
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #snackBar = inject(MatSnackBar);

  readonly isSaving = signal(false);
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

      this.#snackBar.open('Paramètres enregistrés', 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch (error) {
      this.#logger.error('Failed to save settings', error);
      this.#snackBar.open('Erreur lors de la sauvegarde', 'OK', {
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
}
