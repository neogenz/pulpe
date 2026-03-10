import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
} from '@angular/animations';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CurrencyInput } from '@ui/currency-input';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { TranslocoPipe } from '@jsverse/transloco';
import { PostHogService } from '@core/analytics/posthog';
import { UserSettingsApi } from '@core/user-settings';
import { ROUTES } from '@core/routing/routes-constants';
import { CompleteProfileStore } from './complete-profile-store';
import { PAY_DAY_MAX, type SupportedCurrency } from 'pulpe-shared';

@Component({
  selector: 'pulpe-complete-profile-page',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslocoPipe,
    MatButtonToggleModule,
    CurrencyInput,
    ErrorAlert,
    LoadingButton,
  ],
  providers: [CompleteProfileStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInTranslate', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate(
          '350ms cubic-bezier(0.22, 1, 0.36, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }),
        ),
      ]),
    ]),
    trigger('staggerList', [
      transition('* => *', [
        query(
          ':enter',
          [
            style({ opacity: 0, transform: 'translateY(12px)' }),
            stagger(70, [
              animate(
                '300ms cubic-bezier(0.22, 1, 0.36, 1)',
                style({ opacity: 1, transform: 'translateY(0)' }),
              ),
            ]),
          ],
          { optional: true },
        ),
      ]),
    ]),
  ],
  template: `
    <div class="max-w-md mx-auto px-6 py-14 sm:py-20">
      @if (store.isCheckingExistingBudget()) {
        <div class="flex flex-col items-center justify-center min-h-96 gap-6">
          <mat-progress-spinner mode="indeterminate" [diameter]="40" />
          <p class="text-body-large text-on-surface-variant animate-pulse">
            {{ 'completeProfile.loading' | transloco }}
          </p>
        </div>
      } @else {
        <div class="relative">
          <!-- Modern Stepper (Dots) -->
          <div class="flex items-center justify-center gap-3 mb-10">
            @for (step of [1, 2]; track step) {
              <div
                class="h-1.5 rounded-full transition-all duration-500 ease-emphasized"
                [class.w-8]="currentStep() === step"
                [class.w-2]="currentStep() !== step"
                [class.bg-primary]="currentStep() === step"
                [class.bg-outline-variant]="currentStep() !== step"
              ></div>
            }
          </div>

          <!-- Step 1 Content -->
          @if (currentStep() === 1) {
            <div @fadeInTranslate class="flex flex-col items-center">
              <div class="mb-10 text-center max-w-sm">
                <h1
                  class="text-display-small font-bold mb-3 tracking-tight text-on-surface"
                >
                  @if (store.firstName()) {
                    {{
                      'completeProfile.greetingWithName'
                        | transloco: { name: ' ' + store.firstName() }
                    }}
                  } @else {
                    {{ 'completeProfile.greetingNoName' | transloco }}
                  }
                </h1>
                <p
                  class="text-body-large text-on-surface-variant leading-relaxed"
                >
                  {{ 'completeProfile.step1Subtitle' | transloco }}
                </p>
              </div>

              <div class="w-full space-y-6">
                <mat-form-field appearance="outline" class="w-full">
                  <mat-icon matPrefix class="mr-3 text-on-surface-variant"
                    >person</mat-icon
                  >
                  <mat-label>{{
                    'completeProfile.firstName' | transloco
                  }}</mat-label>
                  <input
                    matInput
                    type="text"
                    [ngModel]="store.firstName()"
                    (ngModelChange)="store.updateFirstName($event)"
                    [placeholder]="
                      'completeProfile.firstNamePlaceholder' | transloco
                    "
                    data-testid="first-name-input"
                  />
                </mat-form-field>

                <div class="flex flex-col gap-2">
                  <p class="text-label-medium text-on-surface-variant">
                    Devise
                  </p>
                  <mat-button-toggle-group
                    aria-label="Devise"
                    [value]="selectedCurrency()"
                    (change)="onCurrencyChange($event.value)"
                    data-testid="currency-toggle"
                    class="w-full"
                    hideSingleSelectionIndicator
                  >
                    <mat-button-toggle value="CHF" class="flex-1">
                      CHF
                    </mat-button-toggle>
                    <mat-button-toggle value="EUR" class="flex-1">
                      EUR
                    </mat-button-toggle>
                  </mat-button-toggle-group>
                </div>

                <pulpe-currency-input
                  [label]="'completeProfile.monthlyIncome' | transloco"
                  [value]="store.monthlyIncome()"
                  (valueChange)="store.updateMonthlyIncome($event)"
                  [required]="true"
                  icon="payments"
                  testId="monthly-income-input"
                  [autoFocus]="false"
                  [currency]="selectedCurrency()"
                  [showCurrencySelector]="showCurrencySelector()"
                  (currencyChange)="onCurrencyChange($event)"
                />
              </div>

              <div class="mt-10 w-full flex flex-col items-center gap-4">
                <button
                  matButton="filled"
                  class="w-full h-14 text-title-medium rounded-2xl"
                  [disabled]="!store.isStep1Valid()"
                  data-testid="next-step-button"
                  (click)="nextStep()"
                >
                  <span class="flex items-center justify-center gap-2">
                    {{ 'completeProfile.next' | transloco }}
                    <mat-icon class="!text-xl">arrow_forward</mat-icon>
                  </span>
                </button>

                <div
                  class="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/20"
                >
                  <mat-icon class="text-tertiary !text-lg">shield</mat-icon>
                  <span class="text-label-medium text-on-surface-variant">
                    {{ 'completeProfile.privateData' | transloco }}
                  </span>
                </div>
              </div>
            </div>
          }

          <!-- Step 2 Content -->
          @if (currentStep() === 2) {
            <div @fadeInTranslate>
              <div class="mb-10 text-center">
                <h1
                  class="text-display-small font-bold mb-2 tracking-tight text-on-surface"
                >
                  {{ 'completeProfile.step2Title' | transloco }}
                </h1>
                <p
                  class="text-body-large text-on-surface-variant leading-relaxed"
                >
                  {{ 'completeProfile.step2Subtitle' | transloco }}
                </p>
              </div>

              <div class="space-y-6">
                <mat-form-field appearance="outline" class="w-full">
                  <mat-icon matPrefix class="mr-3 text-on-surface-variant"
                    >event_repeat</mat-icon
                  >
                  <mat-label>{{
                    'completeProfile.payDay' | transloco
                  }}</mat-label>
                  <mat-select
                    [ngModel]="store.payDayOfMonth()"
                    (ngModelChange)="store.updatePayDayOfMonth($event)"
                    data-testid="pay-day-select"
                  >
                    <mat-option [value]="null">{{
                      'completeProfile.payDayFirstOfMonth' | transloco
                    }}</mat-option>
                    @for (day of availableDays; track day) {
                      <mat-option [value]="day">{{
                        'completeProfile.payDayOption' | transloco: { day: day }
                      }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <!-- Collapsible charges section -->
                <div
                  class="rounded-2xl border border-outline-variant/30 overflow-hidden"
                >
                  <button
                    type="button"
                    class="w-full flex items-center justify-between p-4 hover:bg-surface-container/30 transition-colors"
                    (click)="isChargesExpanded.set(!isChargesExpanded())"
                    data-testid="toggle-charges-button"
                  >
                    <div class="flex items-center gap-3">
                      <mat-icon class="text-on-surface-variant"
                        >receipt_long</mat-icon
                      >
                      <div class="text-left">
                        <p class="text-title-medium text-on-surface">
                          {{ 'completeProfile.charges' | transloco }}
                        </p>
                        <p class="text-body-small text-on-surface-variant">
                          {{ 'completeProfile.chargesOptional' | transloco }}
                        </p>
                      </div>
                    </div>
                    <mat-icon
                      class="text-on-surface-variant transition-transform duration-200"
                      [class.rotate-180]="isChargesExpanded()"
                      >expand_more</mat-icon
                    >
                  </button>

                  @if (isChargesExpanded()) {
                    <div class="px-4 pb-4 space-y-4" @staggerList>
                      <pulpe-currency-input
                        [label]="'completeProfile.housing' | transloco"
                        [value]="store.housingCosts()"
                        (valueChange)="store.updateHousingCosts($event)"
                        icon="home"
                        placeholder="0"
                        testId="housing-costs-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.health' | transloco"
                        [value]="store.healthInsurance()"
                        (valueChange)="store.updateHealthInsurance($event)"
                        icon="health_and_safety"
                        placeholder="0"
                        testId="health-insurance-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.phone' | transloco"
                        [value]="store.phonePlan()"
                        (valueChange)="store.updatePhonePlan($event)"
                        icon="smartphone"
                        placeholder="0"
                        testId="phone-plan-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.internet' | transloco"
                        [value]="store.internetPlan()"
                        (valueChange)="store.updateInternetPlan($event)"
                        icon="wifi"
                        placeholder="0"
                        testId="internet-plan-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.transport' | transloco"
                        [value]="store.transportCosts()"
                        (valueChange)="store.updateTransportCosts($event)"
                        icon="directions_car"
                        placeholder="0"
                        testId="transport-costs-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.leasing' | transloco"
                        [value]="store.leasingCredit()"
                        (valueChange)="store.updateLeasingCredit($event)"
                        icon="more_horiz"
                        placeholder="0"
                        testId="leasing-credit-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                      <p
                        class="text-body-small text-on-surface-variant text-center pt-2"
                      >
                        {{ 'completeProfile.chargesFooter' | transloco }}
                      </p>
                    </div>
                  }
                </div>
              </div>

              <pulpe-error-alert [message]="store.error()" class="mt-8" />

              <div class="mt-10 flex flex-col gap-3">
                <pulpe-loading-button
                  [loading]="store.isLoading()"
                  [loadingText]="'completeProfile.loadingSubmit' | transloco"
                  testId="submit-button"
                  class="w-full rounded-2xl"
                  (click)="onSubmit()"
                >
                  <span class="flex items-center justify-center gap-2">
                    {{ 'completeProfile.submit' | transloco }}
                    <mat-icon class="!text-xl">rocket_launch</mat-icon>
                  </span>
                </pulpe-loading-button>

                <div class="flex gap-3">
                  <button
                    matButton="text"
                    class="flex-1 h-12 text-on-surface-variant rounded-2xl hover:bg-surface-container/50"
                    (click)="goToStep(1)"
                    data-testid="back-button"
                  >
                    <span class="flex items-center justify-center gap-1">
                      <mat-icon class="!text-lg">arrow_back</mat-icon>
                      {{ 'completeProfile.back' | transloco }}
                    </span>
                  </button>
                </div>

                <p
                  class="text-center text-body-small text-on-surface-variant mt-2"
                >
                  {{ 'completeProfile.settingsNote' | transloco }}
                </p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
})
export default class CompleteProfilePage {
  protected readonly store = inject(CompleteProfileStore);
  readonly #router = inject(Router);
  readonly #postHogService = inject(PostHogService);
  readonly #userSettings = inject(UserSettingsApi);

  protected readonly showCurrencySelector =
    this.#userSettings.showCurrencySelector;
  protected readonly selectedCurrency = signal<SupportedCurrency>(
    this.#userSettings.currency(),
  );
  protected readonly currentStep = signal<1 | 2>(1);
  protected readonly isChargesExpanded = signal(false);

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
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
      return;
    }
    this.#postHogService.captureEvent('onboarding_started');
  }

  protected onCurrencyChange(value: SupportedCurrency): void {
    this.selectedCurrency.set(value);
  }

  protected nextStep(): void {
    if (this.store.isStep1Valid()) {
      this.#postHogService.captureEvent('profile_step1_completed');
      this.currentStep.set(2);
    }
  }

  protected goToStep(step: 1 | 2): void {
    this.currentStep.set(step);
  }

  protected async onSubmit(): Promise<void> {
    this.#trackStep2Completion();
    const success = await this.store.submitProfile();

    if (success) {
      await this.#saveCurrency();
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
    }
  }

  async #saveCurrency(): Promise<void> {
    try {
      await this.#userSettings.updateSettings({
        currency: this.selectedCurrency(),
      });
    } catch {
      // Non-blocking — budget was created successfully
    }
  }

  #trackStep2Completion(): void {
    const hasAnyCharge =
      this.store.housingCosts() !== null ||
      this.store.healthInsurance() !== null ||
      this.store.phonePlan() !== null ||
      this.store.internetPlan() !== null ||
      this.store.transportCosts() !== null ||
      this.store.leasingCredit() !== null ||
      this.store.payDayOfMonth() !== null;

    const event = hasAnyCharge
      ? 'profile_step2_completed'
      : 'profile_step2_skipped';
    this.#postHogService.captureEvent(event);
  }
}
