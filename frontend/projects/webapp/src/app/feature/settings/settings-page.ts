import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserSettingsApi } from '@core/user-settings';

@Component({
  selector: 'pulpe-settings-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="max-w-2xl mx-auto">
      <h1 class="text-headline-medium mb-6">Paramètres</h1>

      <mat-card appearance="outlined" class="mb-6">
        <mat-card-header>
          <mat-icon matCardAvatar>calendar_today</mat-icon>
          <mat-card-title>Cycle de budget</mat-card-title>
          <mat-card-subtitle>
            Définissez le jour où commence votre mois budgétaire
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content class="pt-4">
          <p class="text-body-medium text-on-surface-variant mb-4">
            Par défaut, votre mois budgétaire suit le calendrier (du 1er au
            dernier jour du mois). Si vous êtes payé à une date spécifique, vous
            pouvez définir cette date comme début de votre mois budgétaire.
          </p>

          <mat-form-field appearance="outline" class="w-full max-w-xs">
            <mat-label>Jour de début du mois</mat-label>
            <mat-select [formControl]="payDayControl">
              <mat-option [value]="null">
                Calendrier standard (1er du mois)
              </mat-option>
              @for (day of availableDays; track day) {
                <mat-option [value]="day"> Le {{ day }} du mois </mat-option>
              }
            </mat-select>
            <mat-hint>
              @if (payDayControl.value) {
                Votre mois budgétaire commence le {{ payDayControl.value }}
              } @else {
                Votre mois budgétaire suit le calendrier standard
              }
            </mat-hint>
          </mat-form-field>

          @if (hasChanges()) {
            <div class="mt-4 flex gap-2">
              <button
                mat-flat-button
                color="primary"
                [disabled]="isSaving()"
                (click)="saveSettings()"
              >
                @if (isSaving()) {
                  <mat-spinner diameter="20" class="mr-2" />
                }
                Enregistrer
              </button>
              <button
                mat-button
                [disabled]="isSaving()"
                (click)="resetChanges()"
              >
                Annuler
              </button>
            </div>
          }
        </mat-card-content>
      </mat-card>

      <!-- Info card about pay day -->
      <mat-card appearance="outlined" class="bg-secondary-container!">
        <mat-card-content class="flex gap-4 items-start">
          <mat-icon class="text-on-secondary-container">info</mat-icon>
          <div>
            <p class="text-body-medium text-on-secondary-container font-medium">
              Comment ça marche ?
            </p>
            <p class="text-body-small text-on-secondary-container mt-1">
              Si vous définissez le jour de paie au 27, alors à partir du 27
              décembre, vous verrez le budget de janvier. Cela vous permet de
              planifier vos dépenses en fonction de votre vrai cycle de revenus.
            </p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SettingsPage {
  readonly #userSettingsApi = inject(UserSettingsApi);
  readonly #snackBar = inject(MatSnackBar);

  readonly payDayControl = new FormControl<number | null>(null);
  readonly isSaving = signal(false);

  readonly availableDays = Array.from({ length: 28 }, (_, i) => i + 1);

  readonly initialValue = computed(() => this.#userSettingsApi.payDayOfMonth());

  readonly hasChanges = computed(() => {
    const initial = this.initialValue();
    const current = this.payDayControl.value;
    return initial !== current;
  });

  constructor() {
    // Initialize the form with the current value
    const currentValue = this.#userSettingsApi.payDayOfMonth();
    this.payDayControl.setValue(currentValue);
  }

  async saveSettings(): Promise<void> {
    if (this.isSaving()) return;

    try {
      this.isSaving.set(true);

      await this.#userSettingsApi.updateSettings({
        payDayOfMonth: this.payDayControl.value,
      });

      this.#snackBar.open('Paramètres enregistrés', 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch {
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
    this.payDayControl.setValue(this.initialValue());
  }
}
