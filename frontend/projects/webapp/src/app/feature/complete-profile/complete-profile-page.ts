import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CurrencyInput } from '@ui/currency-input';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { PostHogService } from '@core/analytics/posthog';
import { ROUTES } from '@core/routing/routes-constants';
import { CompleteProfileStore } from './complete-profile-store';
import { PAY_DAY_MAX } from 'pulpe-shared';

@Component({
  selector: 'pulpe-complete-profile-page',
  imports: [
    FormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    CurrencyInput,
    ErrorAlert,
    LoadingButton,
  ],
  providers: [CompleteProfileStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isCheckingExistingBudget()) {
      <div class="flex items-center justify-center min-h-[400px]">
        <mat-progress-spinner mode="indeterminate" [diameter]="48" />
      </div>
    } @else {
      <div class="max-w-2xl mx-auto p-6">
        <div class="text-center mb-8">
          <h1 class="text-headline-large text-on-surface mb-2">
            Finaliser ton profil
          </h1>
          <p class="text-body-large text-on-surface-variant">
            Quelques informations pour créer ton premier budget
          </p>
        </div>

        <mat-stepper #stepper linear class="complete-profile-stepper">
          <!-- Step 1: Essential info -->
          <mat-step [completed]="store.isStep1Valid()">
            <ng-template matStepLabel>Informations essentielles</ng-template>

            <div class="py-6 space-y-6">
              <mat-form-field class="w-full" appearance="fill">
                <mat-label>Prénom</mat-label>
                <input
                  matInput
                  type="text"
                  [ngModel]="store.firstName()"
                  (ngModelChange)="store.updateFirstName($event)"
                  placeholder="Ton prénom"
                  data-testid="first-name-input"
                  required
                />
                <mat-icon matPrefix>person</mat-icon>
              </mat-form-field>

              <pulpe-currency-input
                label="Revenus mensuels"
                [value]="store.monthlyIncome()"
                (valueChange)="store.updateMonthlyIncome($event)"
                [required]="true"
                testId="monthly-income-input"
                [autoFocus]="false"
              />
            </div>

            <div class="flex justify-end">
              <button
                matButton="filled"
                color="primary"
                matStepperNext
                [disabled]="!store.isStep1Valid()"
                data-testid="next-step-button"
                (click)="onStep1Complete()"
              >
                Suivant
              </button>
            </div>
          </mat-step>

          <!-- Step 2: Optional expenses -->
          <mat-step optional>
            <ng-template matStepLabel>Charges (optionnel)</ng-template>

            <div class="py-6 space-y-4">
              <p class="text-body-medium text-on-surface-variant mb-4">
                Tu peux personnaliser ton budget. Cette étape est optionnelle.
              </p>

              <!-- Pay day selector -->
              <mat-form-field class="w-full" appearance="fill">
                <mat-label>Jour de paie</mat-label>
                <mat-select
                  [ngModel]="store.payDayOfMonth()"
                  (ngModelChange)="store.updatePayDayOfMonth($event)"
                  data-testid="pay-day-select"
                >
                  <mat-option [value]="null"
                    >1er du mois (calendaire)</mat-option
                  >
                  @for (day of availableDays; track day) {
                    <mat-option [value]="day">Le {{ day }}</mat-option>
                  }
                </mat-select>
                <mat-icon matPrefix>calendar_today</mat-icon>
                <mat-hint>
                  @if (store.payDayOfMonth(); as day) {
                    @if (day > 28) {
                      Ton budget commencera le {{ day }}. Si le mois a moins de
                      jours, il débutera le dernier jour disponible.
                    } @else {
                      Ton budget commencera le {{ day }} de chaque mois
                    }
                  } @else {
                    Ton budget suivra le calendrier standard (1er au dernier)
                  }
                </mat-hint>
              </mat-form-field>

              <p class="text-body-small text-on-surface-variant mt-2 mb-4">
                Charges fixes (optionnel)
              </p>

              <pulpe-currency-input
                label="Loyer"
                [value]="store.housingCosts()"
                (valueChange)="store.updateHousingCosts($event)"
                placeholder="0 (optionnel)"
                testId="housing-costs-input"
                [autoFocus]="false"
              />

              <pulpe-currency-input
                label="Assurance maladie"
                [value]="store.healthInsurance()"
                (valueChange)="store.updateHealthInsurance($event)"
                placeholder="0 (optionnel)"
                testId="health-insurance-input"
                [autoFocus]="false"
              />

              <pulpe-currency-input
                label="Téléphone"
                [value]="store.phonePlan()"
                (valueChange)="store.updatePhonePlan($event)"
                placeholder="0 (optionnel)"
                testId="phone-plan-input"
                [autoFocus]="false"
              />

              <pulpe-currency-input
                label="Transport"
                [value]="store.transportCosts()"
                (valueChange)="store.updateTransportCosts($event)"
                placeholder="0 (optionnel)"
                testId="transport-costs-input"
                [autoFocus]="false"
              />

              <pulpe-currency-input
                label="Leasing / Crédits"
                [value]="store.leasingCredit()"
                (valueChange)="store.updateLeasingCredit($event)"
                placeholder="0 (optionnel)"
                testId="leasing-credit-input"
                [autoFocus]="false"
              />
            </div>

            <div class="flex justify-between">
              <button matButton="outlined" matStepperPrevious>Précédent</button>
              <pulpe-loading-button
                [loading]="store.isLoading()"
                loadingText="Création..."
                testId="submit-button"
                [fullWidth]="false"
                (click)="onSubmit()"
              >
                Créer mon budget
              </pulpe-loading-button>
            </div>
          </mat-step>
        </mat-stepper>

        <pulpe-error-alert [message]="store.error()" class="mt-6" />
      </div>
    }
  `,
  host: { class: 'block' },
})
export default class CompleteProfilePage {
  protected readonly store = inject(CompleteProfileStore);
  readonly #router = inject(Router);
  readonly #postHogService = inject(PostHogService);

  protected readonly availableDays = Array.from(
    { length: PAY_DAY_MAX },
    (_, i) => i + 1,
  );

  constructor() {
    this.store.prefillFromOAuthMetadata();
    void this.#initPage();
  }

  async #initPage(): Promise<void> {
    const hasExisting = await this.store.checkExistingBudgets();
    if (hasExisting) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }

  onStep1Complete(): void {
    if (this.store.isStep1Valid()) {
      this.#postHogService.captureEvent('profile_step1_completed');
    }
  }

  protected async onSubmit(): Promise<void> {
    this.#trackStep2Completion();
    const success = await this.store.submitProfile();

    if (success) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }

  #trackStep2Completion(): void {
    const hasAnyCharge =
      this.store.housingCosts() !== null ||
      this.store.healthInsurance() !== null ||
      this.store.phonePlan() !== null ||
      this.store.transportCosts() !== null ||
      this.store.leasingCredit() !== null ||
      this.store.payDayOfMonth() !== null;

    const event = hasAnyCharge
      ? 'profile_step2_completed'
      : 'profile_step2_skipped';
    this.#postHogService.captureEvent(event);
  }
}
