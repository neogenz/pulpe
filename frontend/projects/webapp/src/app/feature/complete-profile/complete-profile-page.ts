import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MatDialog } from '@angular/material/dialog';
import { CurrencyInput } from '@ui/currency-input';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { TranslocoPipe } from '@jsverse/transloco';
import { PostHogService } from '@core/analytics/posthog';
import { ROUTES } from '@core/routing/routes-constants';
import {
  CompleteProfileStore,
  ONBOARDING_SUGGESTIONS,
} from './complete-profile-store';
import { AddCustomExpenseDialog } from './add-custom-expense-dialog';
import { PAY_DAY_MAX } from 'pulpe-shared';

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

                <pulpe-currency-input
                  [label]="'completeProfile.monthlyIncome' | transloco"
                  [value]="store.monthlyIncome()"
                  (valueChange)="store.updateMonthlyIncome($event)"
                  [required]="true"
                  icon="payments"
                  testId="monthly-income-input"
                  [autoFocus]="false"
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

                <!-- Charge groups (tighter spacing within) -->
                <div class="space-y-4">
                  <!-- Logement -->
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <mat-icon class="!text-base text-on-surface-variant/60"
                        >home</mat-icon
                      >
                      <span class="text-label-medium text-on-surface-variant">
                        {{ 'completeProfile.chargeGroups.housing' | transloco }}
                      </span>
                    </div>
                    <pulpe-currency-input
                      [label]="'completeProfile.housing' | transloco"
                      [value]="store.housingCosts()"
                      (valueChange)="store.updateHousingCosts($event)"
                      icon="home"
                      placeholder="0"
                      testId="housing-costs-input"
                      [autoFocus]="false"
                    />
                  </div>

                  <!-- Assurance & Abonnements -->
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <mat-icon class="!text-base text-on-surface-variant/60"
                        >health_and_safety</mat-icon
                      >
                      <span class="text-label-medium text-on-surface-variant">
                        {{
                          'completeProfile.chargeGroups.insuranceSubscriptions'
                            | transloco
                        }}
                      </span>
                    </div>
                    <div class="space-y-3">
                      <pulpe-currency-input
                        [label]="'completeProfile.health' | transloco"
                        [value]="store.healthInsurance()"
                        (valueChange)="store.updateHealthInsurance($event)"
                        icon="health_and_safety"
                        placeholder="0"
                        testId="health-insurance-input"
                        [autoFocus]="false"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.phone' | transloco"
                        [value]="store.phonePlan()"
                        (valueChange)="store.updatePhonePlan($event)"
                        icon="smartphone"
                        placeholder="0"
                        testId="phone-plan-input"
                        [autoFocus]="false"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.internet' | transloco"
                        [value]="store.internetPlan()"
                        (valueChange)="store.updateInternetPlan($event)"
                        icon="wifi"
                        placeholder="0"
                        testId="internet-plan-input"
                        [autoFocus]="false"
                      />
                    </div>
                  </div>

                  <!-- Mobilité & Crédit -->
                  <div>
                    <div class="flex items-center gap-2 mb-2">
                      <mat-icon class="!text-base text-on-surface-variant/60"
                        >directions_car</mat-icon
                      >
                      <span class="text-label-medium text-on-surface-variant">
                        {{
                          'completeProfile.chargeGroups.mobilityCredit'
                            | transloco
                        }}
                      </span>
                    </div>
                    <div class="space-y-3">
                      <pulpe-currency-input
                        [label]="'completeProfile.transport' | transloco"
                        [value]="store.transportCosts()"
                        (valueChange)="store.updateTransportCosts($event)"
                        icon="directions_car"
                        placeholder="0"
                        testId="transport-costs-input"
                        [autoFocus]="false"
                      />
                      <pulpe-currency-input
                        [label]="'completeProfile.leasing' | transloco"
                        [value]="store.leasingCredit()"
                        (valueChange)="store.updateLeasingCredit($event)"
                        icon="more_horiz"
                        placeholder="0"
                        testId="leasing-credit-input"
                        [autoFocus]="false"
                      />
                    </div>
                  </div>

                  <!-- Personnaliser ton budget (same spacing as charge groups) -->
                  <div>
                    <div class="flex items-center gap-2 mb-4">
                      <mat-icon class="!text-base text-on-surface-variant/60"
                        >tune</mat-icon
                      >
                      <span class="text-label-medium text-on-surface-variant">
                        {{
                          'completeProfile.customize.sectionTitle' | transloco
                        }}
                      </span>
                    </div>

                    <!-- Quick-add suggestions -->
                    <p class="text-body-small text-on-surface-variant mb-2">
                      {{
                        'completeProfile.suggestions.sectionTitle' | transloco
                      }}
                    </p>
                    <div
                      class="flex flex-wrap gap-2 mb-5"
                      data-testid="suggestion-chips"
                    >
                      @for (suggestion of suggestions; track suggestion.name) {
                        <button
                          type="button"
                          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-label-large transition-colors border"
                          [class.bg-primary-container]="
                            store.selectedSuggestionNames().has(suggestion.name)
                          "
                          [class.text-on-primary-container]="
                            store.selectedSuggestionNames().has(suggestion.name)
                          "
                          [class.border-primary]="
                            store.selectedSuggestionNames().has(suggestion.name)
                          "
                          [class.bg-surface-container]="
                            !store
                              .selectedSuggestionNames()
                              .has(suggestion.name)
                          "
                          [class.text-on-surface-variant]="
                            !store
                              .selectedSuggestionNames()
                              .has(suggestion.name)
                          "
                          [class.border-transparent]="
                            !store
                              .selectedSuggestionNames()
                              .has(suggestion.name)
                          "
                          (click)="store.toggleSuggestion(suggestion)"
                          [attr.data-testid]="
                            'suggestion-chip-' + suggestion.name
                          "
                        >
                          {{ suggestion.name }}
                          ·
                          <span class="ph-no-capture"
                            >{{ suggestion.amount }}.-</span
                          >
                        </button>
                      }
                    </div>

                    <!-- Custom transactions list -->
                    @if (store.customTransactions().length > 0) {
                      <div class="space-y-2 mb-4">
                        @for (tx of store.customTransactions(); track $index) {
                          <div
                            class="flex items-center justify-between px-4 py-3 rounded-xl border border-outline-variant/30"
                          >
                            <span class="text-body-medium text-on-surface">{{
                              tx.name
                            }}</span>
                            <div class="flex items-center gap-2">
                              <input
                                type="number"
                                inputmode="decimal"
                                class="w-20 text-right text-body-medium text-on-surface ph-no-capture bg-transparent border-b border-outline-variant/40 focus:border-primary outline-none py-0.5"
                                [value]="tx.amount"
                                (change)="onAmountChange($index, $event)"
                                data-testid="custom-expense-amount"
                              />
                              <span
                                class="text-body-small text-on-surface-variant"
                                >CHF</span
                              >
                              <button
                                matIconButton
                                (click)="store.removeCustomTransaction($index)"
                                data-testid="remove-custom-expense"
                              >
                                <mat-icon class="text-on-surface-variant"
                                  >close</mat-icon
                                >
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Add custom -->
                    <button
                      matButton="outlined"
                      class="w-full h-12 rounded-xl"
                      (click)="openAddCustomExpenseDialog()"
                      data-testid="add-custom-expense-button"
                    >
                      <span class="flex items-center justify-center gap-2">
                        <mat-icon>add</mat-icon>
                        {{
                          'completeProfile.customExpense.addButton' | transloco
                        }}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <pulpe-error-alert [message]="store.error()" class="mt-8" />

              <div class="mt-16 flex flex-col gap-3">
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
  readonly #dialog = inject(MatDialog);
  readonly #destroyRef = inject(DestroyRef);
  readonly #postHogService = inject(PostHogService);

  protected readonly suggestions = ONBOARDING_SUGGESTIONS;
  protected readonly currentStep = signal<1 | 2>(1);

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

  protected nextStep(): void {
    if (this.store.isStep1Valid()) {
      this.#postHogService.captureEvent('profile_step1_completed');
      this.currentStep.set(2);
    }
  }

  protected goToStep(step: 1 | 2): void {
    this.currentStep.set(step);
  }

  protected onAmountChange(index: number, event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    if (!isNaN(value) && value > 0) {
      this.store.updateCustomTransactionAmount(index, value);
    }
  }

  protected openAddCustomExpenseDialog(): void {
    this.#dialog
      .open(AddCustomExpenseDialog, { width: '400px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((result) => {
        if (result) {
          this.store.addCustomTransaction(result);
        }
      });
  }

  protected async onSubmit(): Promise<void> {
    this.#trackStep2Completion();
    const success = await this.store.submitProfile();

    if (success) {
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
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
