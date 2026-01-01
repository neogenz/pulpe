import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
  styles: `
    .mat-mdc-card-content {
      padding: 16px;
    }
  `,
  template: `
    <div class="max-w-2xl mx-auto">
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
          <mat-card-title>Cycle de budget</mat-card-title>
          <mat-card-subtitle>
            Définissez le jour où commence votre mois budgétaire
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <p class="text-body-medium text-on-surface-variant mb-4">
            Par défaut, votre mois budgétaire suit le calendrier (du 1er au
            dernier jour du mois). Si vous êtes payé à une date spécifique, vous
            pouvez définir cette date comme début de votre mois budgétaire.
          </p>

          <mat-form-field
            appearance="outline"
            [class.pb-4]="!hasChanges()"
            class="w-full md:pb-0!"
          >
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
              @if (payDayControl.value && payDayControl.value > 28) {
                Votre mois budgétaire commence le {{ payDayControl.value }}. Si
                le mois a moins de jours, il débutera le dernier jour
                disponible.
              } @else if (payDayControl.value) {
                Votre mois budgétaire commence le {{ payDayControl.value }}
              } @else {
                Votre mois budgétaire suit le calendrier standard
              }
            </mat-hint>
          </mat-form-field>
        </mat-card-content>

        @if (hasChanges()) {
          <mat-card-actions class="gap-2">
            <button
              matButton
              color="warn"
              [disabled]="isSaving()"
              (click)="resetChanges()"
            >
              Annuler
            </button>
            <button
              matButton="filled"
              color="primary"
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
            <mat-icon class="text-on-secondary-container!">info</mat-icon>
          </div>
          <div class="flex-1">
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

  readonly availableDays = Array.from({ length: 31 }, (_, i) => i + 1);

  // Convert form valueChanges to a signal for reactive change detection
  readonly #currentFormValue = toSignal(this.payDayControl.valueChanges, {
    initialValue: this.payDayControl.value,
  });

  readonly initialValue = computed(() => this.#userSettingsApi.payDayOfMonth());

  readonly hasChanges = computed(() => {
    const initial = this.initialValue();
    const current = this.#currentFormValue();
    return initial !== current;
  });

  constructor() {
    // Initialize the form when API value is loaded
    effect(() => {
      const apiValue = this.#userSettingsApi.payDayOfMonth();
      if (apiValue !== undefined) {
        this.payDayControl.setValue(apiValue, { emitEvent: false });
      }
    });
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
