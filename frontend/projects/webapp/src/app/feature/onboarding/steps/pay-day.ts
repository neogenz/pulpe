import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { OnboardingStore } from '../onboarding-store';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-pay-day',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gap-6 h-full flex flex-col">
      <div class="text-center space-y-2 mb-6">
        <h1 class="text-headline-large text-on-surface">
          À quelle date es-tu payé ?
        </h1>
        <p class="text-body-large text-on-surface-variant leading-relaxed">
          Ton budget commencera le jour où tu reçois ton salaire.
        </p>
      </div>

      <mat-form-field appearance="fill" class="w-full">
        <mat-label>Jour de paie</mat-label>
        <mat-select [formControl]="payDayControl" data-testid="pay-day-select">
          <mat-option [value]="null"> 1er du mois </mat-option>
          @for (day of availableDays; track day) {
            <mat-option [value]="day"> Le {{ day }} </mat-option>
          }
        </mat-select>
        <mat-icon matPrefix>calendar_today</mat-icon>
        <mat-hint>
          @if (payDayControl.value && payDayControl.value > 28) {
            Ton budget commencera le {{ payDayControl.value }}. Si le mois a
            moins de jours, il débutera le dernier jour disponible.
          } @else if (payDayControl.value) {
            Ton budget commencera le {{ payDayControl.value }} de chaque mois
          } @else {
            Ton budget suivra le calendrier standard
          }
        </mat-hint>
      </mat-form-field>

      <div class="flex gap-4 p-4 md:p-0 w-full mt-auto">
        <button
          matButton="outlined"
          class="flex-1"
          data-testid="previous-button"
          (click)="onPrevious()"
        >
          Précédent
        </button>
        <button
          matButton="text"
          class="flex-1"
          data-testid="skip-button"
          (click)="onSkip()"
        >
          Passer
        </button>
        <button
          matButton="filled"
          color="primary"
          class="flex-1"
          data-testid="next-button"
          (click)="onNext()"
        >
          Suivant
        </button>
      </div>
    </div>
  `,
})
export default class PayDay {
  readonly #store = inject(OnboardingStore);
  readonly #router = inject(Router);

  protected readonly payDayControl = new FormControl<number | null>(null);

  protected readonly availableDays = Array.from(
    { length: 31 },
    (_, i) => i + 1,
  );

  constructor() {
    this.payDayControl.setValue(this.#store.data().payDayOfMonth);
  }

  onNext(): void {
    this.#store.updateField('payDayOfMonth', this.payDayControl.value);
    this.#navigateToNext();
  }

  onSkip(): void {
    this.#store.updateField('payDayOfMonth', null);
    this.#navigateToNext();
  }

  onPrevious(): void {
    this.#router.navigate(['/', ROUTES.ONBOARDING, ROUTES.ONBOARDING_income]);
  }

  #navigateToNext(): void {
    this.#router.navigate(['/', ROUTES.ONBOARDING, ROUTES.ONBOARDING_HOUSING]);
  }
}
