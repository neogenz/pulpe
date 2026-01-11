import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyInput } from '@ui/currency-input';
import { ROUTES } from '@core/routing/routes-constants';
import { CompleteProfileStore } from './complete-profile-store';

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
    CurrencyInput,
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

        <mat-stepper #stepper linear class="bg-transparent">
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
                Tu peux ajouter tes charges fixes pour un budget plus précis.
                Cette étape est optionnelle.
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
              <button
                matButton="filled"
                color="primary"
                [disabled]="store.isLoading()"
                (click)="onSubmit()"
                data-testid="submit-button"
              >
                @if (store.isLoading()) {
                  <div class="flex items-center gap-2">
                    <mat-progress-spinner
                      mode="indeterminate"
                      [diameter]="20"
                      class="pulpe-loading-indicator pulpe-loading-small"
                    />
                    Création...
                  </div>
                } @else {
                  Créer mon budget
                }
              </button>
            </div>
          </mat-step>
        </mat-stepper>

        @if (store.error()) {
          <div
            class="mt-6 bg-error-container text-on-error-container p-4 rounded-lg flex items-center gap-2"
          >
            <mat-icon>error_outline</mat-icon>
            <span>{{ store.error() }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    ::ng-deep .mat-stepper-horizontal {
      background: transparent !important;
    }

    ::ng-deep .mat-horizontal-stepper-header-container {
      padding: 0 !important;
    }
  `,
})
export default class CompleteProfilePage {
  protected readonly store = inject(CompleteProfileStore);
  readonly #router = inject(Router);

  constructor() {
    this.#checkExistingBudgetsAndRedirect();
  }

  async #checkExistingBudgetsAndRedirect(): Promise<void> {
    const hasExisting = await this.store.checkExistingBudgets();

    if (hasExisting) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }

  protected async onSubmit(): Promise<void> {
    const success = await this.store.submitProfile();

    if (success) {
      this.#router.navigate(['/', ROUTES.APP, ROUTES.CURRENT_MONTH]);
    }
  }
}
