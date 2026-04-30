import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AppCurrencyPipe, CURRENCY_CONFIG } from '@core/currency';
import { CurrencyInput } from '@ui/currency-input';
import { ErrorAlert } from '@ui/error-alert';
import { LoadingButton } from '@ui/loading-button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FinancialKindDirective } from '@ui/financial-kind';
import { PostHogService } from '@core/analytics/posthog';
import { FeatureFlagsService } from '@core/feature-flags';
import { UserSettingsStore } from '@core/user-settings';
import { ROUTES } from '@core/routing/routes-constants';
import {
  CompleteProfileStore,
  MAX_CUSTOM_TRANSACTIONS,
  ONBOARDING_SUGGESTIONS,
} from './complete-profile-store';
import { OnboardingPreviewDesktop } from './components/onboarding-preview-desktop';
import {
  CURRENCY_METADATA,
  PAY_DAY_MAX,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from 'pulpe-shared';

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
    FinancialKindDirective,
    AppCurrencyPipe,
    CurrencyInput,
    ErrorAlert,
    LoadingButton,
    OnboardingPreviewDesktop,
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
  ],
  styles: `
    .currency-tile {
      transition:
        border-color var(--pulpe-motion-base) var(--pulpe-ease-emphasized),
        background-color var(--pulpe-motion-base) var(--pulpe-ease-emphasized),
        transform 120ms var(--pulpe-ease-standard);
    }
    .currency-tile:active {
      transform: scale(0.98);
    }
    /* mat-icon needs font-size/width/height/line-height synchronized to keep the glyph centered. */
    .currency-tile-check {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
  `,
  template: `
    <div class="max-w-2xl lg:max-w-6xl mx-auto px-4 sm:px-0">
      @if (store.isCheckingExistingBudget()) {
        <div class="flex flex-col items-center justify-center min-h-96 gap-6">
          <mat-progress-spinner mode="indeterminate" [diameter]="40" />
          <p class="text-body-large text-on-surface-variant animate-pulse">
            {{ 'completeProfile.loading' | transloco }}
          </p>
        </div>
      } @else {
        <div class="relative">
          <!-- Stepper: two labelled pills with a connector -->
          <div
            class="flex items-center justify-center gap-3 mb-10"
            role="group"
            [attr.aria-label]="
              'completeProfile.stepperAriaLabel'
                | transloco: { current: currentStep(), total: 2 }
            "
          >
            @for (step of stepperSteps; track step.number; let i = $index) {
              @if (i > 0) {
                <div
                  class="h-px w-10 bg-outline-variant/60"
                  aria-hidden="true"
                ></div>
              }
              <div
                class="stepper-pill inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all duration-500"
                [class.bg-primary]="currentStep() === step.number"
                [class.text-on-primary]="currentStep() === step.number"
                [class.bg-surface-container]="currentStep() !== step.number"
                [class.text-on-surface-variant]="currentStep() !== step.number"
                [attr.aria-current]="
                  currentStep() === step.number ? 'step' : null
                "
              >
                <span
                  class="text-label-small font-semibold tabular-nums opacity-80"
                  aria-hidden="true"
                >
                  {{ step.number }}
                </span>
                <span class="text-label-medium font-medium">
                  {{ step.labelKey | transloco }}
                </span>
              </div>
            }
          </div>

          <!-- Step 1: split layout with live preview -->
          @if (currentStep() === 1) {
            <div
              @fadeInTranslate
              class="pb-14 sm:pb-20 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16 lg:items-start"
            >
              <!-- Left column: header + form -->
              <div class="flex flex-col max-w-md lg:max-w-none mx-auto lg:mx-0">
                <div class="mb-10 text-center lg:text-left">
                  <h1
                    class="text-headline-medium md:text-display-small font-bold mb-3 tracking-tight text-on-surface text-balance"
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
                    {{ 'completeProfile.step1Intro' | transloco }}
                  </p>
                </div>

                <div class="w-full space-y-6">
                  @if (isMultiCurrencyEnabled()) {
                    <fieldset class="flex flex-col gap-2">
                      <legend
                        class="text-label-medium text-on-surface-variant mb-2"
                      >
                        {{ 'completeProfile.currencyLabel' | transloco }}
                      </legend>
                      <div class="grid grid-cols-2 gap-3" role="radiogroup">
                        @for (currency of currencies; track currency) {
                          @let meta = currencyMetadata[currency];
                          @let isSelected = selectedCurrency() === currency;
                          <button
                            type="button"
                            role="radio"
                            [attr.aria-checked]="isSelected"
                            (click)="onCurrencyChange(currency)"
                            class="currency-tile group flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-300 ease-emphasized focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            [class.border-primary]="isSelected"
                            [class.bg-primary-container]="isSelected"
                            [class.text-on-primary-container]="isSelected"
                            [class.border-outline-variant]="!isSelected"
                            [class.bg-surface-container-low]="!isSelected"
                            [class.hover:border-outline]="!isSelected"
                            [attr.data-testid]="'currency-tile-' + currency"
                          >
                            <span
                              class="text-2xl leading-none"
                              aria-hidden="true"
                              >{{ meta.flag }}</span
                            >
                            <span class="flex flex-col min-w-0">
                              <span class="text-title-medium font-semibold">{{
                                currency
                              }}</span>
                              <span
                                class="text-label-small opacity-80 truncate"
                                >{{ meta.nativeName }}</span
                              >
                            </span>
                            <mat-icon
                              class="currency-tile-check ml-auto shrink-0 transition-opacity duration-300"
                              [class.opacity-100]="isSelected"
                              [class.opacity-0]="!isSelected"
                              aria-hidden="true"
                              >check_circle</mat-icon
                            >
                          </button>
                        }
                      </div>
                      <p
                        class="text-label-small text-on-surface-variant/80 mt-1"
                      >
                        {{ 'completeProfile.currencyHint' | transloco }}
                      </p>
                    </fieldset>
                  }

                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                    class="w-full"
                  >
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
                      autocomplete="given-name"
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
                    [currency]="selectedCurrency()"
                    [showCurrencySelector]="showCurrencySelector()"
                    (currencyChange)="onCurrencyChange($event)"
                  />

                  <mat-form-field
                    appearance="outline"
                    subscriptSizing="dynamic"
                    floatLabel="always"
                    class="w-full"
                  >
                    <mat-icon matPrefix class="mr-3 text-on-surface-variant"
                      >event_repeat</mat-icon
                    >
                    <mat-label>{{
                      'completeProfile.payDay' | transloco
                    }}</mat-label>
                    <mat-select
                      [ngModel]="store.payDayOfMonth()"
                      (ngModelChange)="store.updatePayDayOfMonth($event)"
                      [placeholder]="
                        'completeProfile.payDayPlaceholder' | transloco
                      "
                      data-testid="pay-day-select"
                    >
                      @for (day of availableDays; track day) {
                        <mat-option [value]="day">{{
                          'completeProfile.payDayOption'
                            | transloco: { day: day }
                        }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Mobile compact preview (between form and CTA) -->
                <div class="lg:hidden mt-8" aria-hidden="true">
                  <div
                    class="onboarding-preview-mobile flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-surface-container border border-outline-variant/30"
                    [class.opacity-60]="!store.monthlyIncome()"
                  >
                    <div class="flex flex-col min-w-0">
                      <span
                        class="text-label-small text-on-surface-variant uppercase tracking-[0.08em]"
                      >
                        {{
                          'completeProfile.preview.title'
                            | transloco: { month: currentMonthLabel }
                        }}
                      </span>
                      <span
                        class="text-title-large font-bold text-on-surface ph-no-capture truncate"
                      >
                        @if (store.monthlyIncome()) {
                          {{
                            store.monthlyIncome()
                              | appCurrency: selectedCurrency() : '1.0-0'
                          }}
                        } @else {
                          —
                        }
                      </span>
                    </div>
                    @if (payDayLabel(); as label) {
                      <span
                        class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-label-small text-on-surface-variant"
                      >
                        <mat-icon class="!text-base">event</mat-icon>
                        {{ label }}
                      </span>
                    }
                  </div>
                </div>

                <div class="mt-10 w-full flex flex-col items-stretch gap-4">
                  <button
                    matButton="filled"
                    class="w-full h-14 text-title-medium rounded-2xl"
                    [disabled]="!store.isStep1Valid()"
                    data-testid="next-step-button"
                    (click)="nextStep()"
                  >
                    <span class="flex items-center justify-center gap-2">
                      {{ ctaLabel() | transloco }}
                      @if (store.isStep1Valid()) {
                        <mat-icon class="!text-xl">arrow_forward</mat-icon>
                      }
                    </span>
                  </button>

                  <div
                    class="inline-flex self-center items-center gap-2 px-4 py-2 rounded-full border border-outline-variant/20"
                  >
                    <mat-icon class="text-tertiary !text-lg">shield</mat-icon>
                    <span class="text-label-medium text-on-surface-variant">
                      {{ 'completeProfile.privateData' | transloco }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right column: sticky live preview (desktop only) -->
              <pulpe-onboarding-preview-desktop
                class="hidden lg:block lg:sticky lg:top-8"
                [firstName]="store.firstName()"
                [monthlyIncome]="store.monthlyIncome()"
                [payDayOfMonth]="store.payDayOfMonth()"
                [currencyCode]="selectedCurrency()"
                [currencyFlag]="currencyMetadata[selectedCurrency()].flag"
                [monthLabel]="currentMonthLabel"
                [isReady]="store.isStep1Valid()"
              />
            </div>
          }

          <!-- Step 2 Content -->
          @if (currentStep() === 2) {
            <div
              @fadeInTranslate
              class="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16 lg:items-start"
            >
              <!-- Left column: header + form -->
              <div class="max-w-md lg:max-w-none mx-auto lg:mx-0">
                <div class="mb-8 text-center lg:text-left">
                  <h1
                    class="text-headline-small md:text-headline-large font-bold mb-2 tracking-tight text-on-surface text-balance"
                  >
                    {{ 'completeProfile.step2Title' | transloco }}
                  </h1>
                  <p
                    class="text-body-medium md:text-body-large text-on-surface-variant leading-relaxed"
                  >
                    {{ 'completeProfile.step2Subtitle' | transloco }}
                  </p>
                </div>

                @let summary = store.budgetSummary();
                @let isSurplus = hasAvailableSurplus();

                <!-- Mobile-only: compact summary at top (desktop has sticky sidebar) -->
                <div
                  class="lg:hidden grid grid-cols-3 gap-2 px-4 py-4 rounded-2xl mb-4 transition-colors"
                  [class.bg-surface-container]="isSurplus"
                  [class.bg-error-container]="!isSurplus"
                >
                  <div class="flex flex-col">
                    <span class="text-label-small text-on-surface-variant">
                      {{ 'completeProfile.summary.income' | transloco }}
                    </span>
                    <span
                      class="text-body-medium text-on-surface ph-no-capture"
                    >
                      {{
                        summary.income
                          | appCurrency: selectedCurrency() : '1.0-0'
                      }}
                    </span>
                  </div>
                  <div class="flex flex-col items-center">
                    <span class="text-label-small text-on-surface-variant">
                      {{ 'completeProfile.summary.committed' | transloco }}
                    </span>
                    <span
                      class="text-body-medium text-on-surface-variant ph-no-capture"
                    >
                      {{
                        summary.committed
                          | appCurrency: selectedCurrency() : '1.0-0'
                      }}
                    </span>
                  </div>
                  <div class="flex flex-col items-end">
                    <span class="text-label-small text-on-surface-variant">
                      {{ 'completeProfile.summary.available' | transloco }}
                    </span>
                    <span
                      class="text-title-medium font-bold ph-no-capture"
                      [class.text-primary]="isSurplus"
                      [class.text-error]="!isSurplus"
                    >
                      {{
                        summary.available
                          | appCurrency: selectedCurrency() : '1.0-0'
                      }}
                    </span>
                  </div>
                </div>

                @if (!isSurplus) {
                  <p
                    class="lg:hidden text-body-small text-on-surface-variant text-center mb-4"
                  >
                    {{ 'completeProfile.summary.deficitHint' | transloco }}
                  </p>
                }

                <!-- Screen-reader-only live announcement: only the changing "Disponible"
                     value, so VoiceOver/NVDA polite-announce the delta when the user
                     toggles a chip or edits an amount. -->
                <span class="sr-only" role="status" aria-live="polite">
                  {{ liveBudgetAnnouncement() }}
                </span>

                <div class="space-y-8">
                  <!-- Logement -->
                  <section>
                    <div class="flex items-center gap-2.5 mb-4">
                      <mat-icon class="!text-xl text-on-surface-variant"
                        >home</mat-icon
                      >
                      <h2
                        class="text-title-small font-semibold text-on-surface"
                      >
                        {{ 'completeProfile.chargeGroups.housing' | transloco }}
                      </h2>
                    </div>
                    <pulpe-currency-input
                      [label]="'completeProfile.housing' | transloco"
                      [value]="store.housingCosts()"
                      (valueChange)="store.updateHousingCosts($event)"
                      placeholder="0"
                      testId="housing-costs-input"
                      [autoFocus]="false"
                      [currency]="selectedCurrency()"
                      [showCurrencySelector]="showCurrencySelector()"
                      (currencyChange)="onCurrencyChange($event)"
                    />
                  </section>

                  <!-- Assurance & Abonnements -->
                  <section class="border-t border-outline-variant/30 pt-8">
                    <div class="flex items-center gap-2.5 mb-4">
                      <mat-icon class="!text-xl text-on-surface-variant"
                        >health_and_safety</mat-icon
                      >
                      <h2
                        class="text-title-small font-semibold text-on-surface"
                      >
                        {{
                          'completeProfile.chargeGroups.insuranceSubscriptions'
                            | transloco
                        }}
                      </h2>
                    </div>
                    <div class="space-y-3">
                      <pulpe-currency-input
                        [label]="'completeProfile.health' | transloco"
                        [value]="store.healthInsurance()"
                        (valueChange)="store.updateHealthInsurance($event)"
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
                        placeholder="0"
                        testId="internet-plan-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                    </div>
                  </section>

                  <!-- Mobilité & Crédit -->
                  <section class="border-t border-outline-variant/30 pt-8">
                    <div class="flex items-center gap-2.5 mb-4">
                      <mat-icon class="!text-xl text-on-surface-variant"
                        >directions_car</mat-icon
                      >
                      <h2
                        class="text-title-small font-semibold text-on-surface"
                      >
                        {{
                          'completeProfile.chargeGroups.mobilityCredit'
                            | transloco
                        }}
                      </h2>
                    </div>
                    <div class="space-y-3">
                      <pulpe-currency-input
                        [label]="'completeProfile.transport' | transloco"
                        [value]="store.transportCosts()"
                        (valueChange)="store.updateTransportCosts($event)"
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
                        placeholder="0"
                        testId="leasing-credit-input"
                        [autoFocus]="false"
                        [currency]="selectedCurrency()"
                        [showCurrencySelector]="showCurrencySelector()"
                        (currencyChange)="onCurrencyChange($event)"
                      />
                    </div>
                  </section>

                  <!-- Personnaliser ton budget -->
                  <section class="border-t border-outline-variant/30 pt-8">
                    <div class="flex items-center gap-2.5 mb-4">
                      <mat-icon class="!text-xl text-on-surface-variant"
                        >tune</mat-icon
                      >
                      <h2
                        class="text-title-small font-semibold text-on-surface"
                      >
                        {{
                          'completeProfile.customize.sectionTitle' | transloco
                        }}
                      </h2>
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
                        @let isSelected =
                          store.selectedSuggestionNames().has(suggestion.name);
                        @let isChipDisabled =
                          !isSelected && store.customTransactionsLimitReached();
                        <button
                          type="button"
                          class="inline-flex items-center gap-1.5 px-4 min-h-11 rounded-full text-label-large transition-colors border disabled:opacity-50 disabled:cursor-not-allowed"
                          [class.bg-primary-container]="isSelected"
                          [class.text-on-primary-container]="isSelected"
                          [class.border-primary]="isSelected"
                          [class.bg-surface-container]="!isSelected"
                          [class.text-on-surface-variant]="!isSelected"
                          [class.border-transparent]="!isSelected"
                          [attr.aria-pressed]="isSelected"
                          [disabled]="isChipDisabled"
                          (click)="store.toggleSuggestion(suggestion)"
                          [attr.data-testid]="
                            'suggestion-chip-' + suggestion.name
                          "
                        >
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            [class.bg-financial-expense]="
                              suggestion.type === 'expense'
                            "
                            [class.bg-primary]="suggestion.type === 'saving'"
                          ></span>
                          {{ suggestion.name }}
                          ·
                          <span class="ph-no-capture">{{
                            suggestion.amount
                              | appCurrency: selectedCurrency() : '1.0-0'
                          }}</span>
                        </button>
                      }
                    </div>

                    <!-- Custom transactions list -->
                    @if (store.customTransactions().length > 0) {
                      <div class="space-y-2 mb-4">
                        @for (
                          tx of store.customTransactions();
                          track $index;
                          let i = $index
                        ) {
                          <div
                            class="flex items-center justify-between px-4 py-3 rounded-xl border border-outline-variant/30"
                          >
                            <div class="flex flex-col min-w-0">
                              <span
                                class="text-body-medium text-on-surface ph-no-capture truncate"
                                >{{ tx.name }}</span
                              >
                              <span
                                class="text-label-small"
                                [pulpeFinancialKind]="tx.type"
                                >{{
                                  labelKeyForType(tx.type) | transloco
                                }}</span
                              >
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                              <input
                                type="number"
                                inputmode="decimal"
                                class="w-20 text-right text-body-medium text-on-surface bg-surface-container rounded-xl px-2 py-1.5 border border-outline-variant/30 focus:border-primary focus:outline-none transition-colors"
                                [value]="tx.amount"
                                (change)="onAmountChange(i, $event)"
                                [attr.aria-label]="
                                  'completeProfile.customExpense.amountAriaLabel'
                                    | transloco: { name: tx.name }
                                "
                                data-testid="custom-expense-amount"
                              />
                              <span
                                class="text-body-small text-on-surface-variant ph-no-capture"
                                >{{ selectedCurrency() }}</span
                              >
                              <button
                                matIconButton
                                [attr.aria-label]="
                                  'completeProfile.customExpense.removeAriaLabel'
                                    | transloco: { name: tx.name }
                                "
                                (click)="removeTransaction(i)"
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

                    <!-- Add custom (dialog) -->
                    <button
                      matButton="outlined"
                      class="w-full h-12 rounded-2xl"
                      [disabled]="store.customTransactionsLimitReached()"
                      (click)="openAddCustomDialog()"
                      data-testid="add-custom-expense-button"
                    >
                      <span class="flex items-center justify-center gap-2">
                        <mat-icon>add</mat-icon>
                        {{
                          'completeProfile.customExpense.addButton' | transloco
                        }}
                      </span>
                    </button>
                    @if (store.customTransactionsLimitReached()) {
                      <p
                        class="mt-2 text-body-small text-on-surface-variant"
                        role="status"
                        data-testid="custom-expense-limit-message"
                      >
                        {{
                          'completeProfile.customExpense.limitReached'
                            | transloco: { max: maxCustomTransactions }
                        }}
                      </p>
                    }
                  </section>
                </div>

                <pulpe-error-alert [message]="store.error()" class="mt-6" />

                <div class="h-16 lg:h-10" aria-hidden="true"></div>

                <!-- Sticky CTA: lives inside left column so it naturally spans form width on desktop. -->
                <div
                  class="sticky bottom-0 z-10 -mx-4 sm:mx-0 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] lg:pb-5 border-t border-outline-variant/15 bg-surface"
                >
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

                  <div class="flex items-center justify-between mt-3">
                    <button
                      matButton
                      class="h-10 text-on-surface-variant rounded-2xl"
                      (click)="goToStep(1)"
                      data-testid="back-button"
                    >
                      <span class="flex items-center gap-1">
                        <mat-icon class="!text-lg">arrow_back</mat-icon>
                        {{ 'completeProfile.back' | transloco }}
                      </span>
                    </button>

                    <span class="text-body-small text-on-surface-variant">
                      {{ 'completeProfile.settingsNote' | transloco }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right column: compact sticky summary (desktop only) -->
              <aside
                class="hidden lg:block lg:sticky lg:top-8"
                [attr.aria-label]="
                  'completeProfile.preview.summaryAriaLabel' | transloco
                "
              >
                <div
                  class="onboarding-summary-desktop relative p-6 rounded-2xl border transition-colors duration-500 ease-emphasized"
                  [class.border-outline-variant]="isSurplus"
                  [class.bg-error-container]="!isSurplus"
                  [class.border-error]="!isSurplus"
                >
                  <div class="flex items-center justify-between mb-4">
                    <span
                      class="text-label-small uppercase tracking-[0.12em] text-on-surface-variant/80"
                    >
                      {{
                        'completeProfile.preview.title'
                          | transloco: { month: currentMonthLabel }
                      }}
                    </span>
                    <span class="text-xl leading-none" aria-hidden="true">
                      {{ currencyMetadata[selectedCurrency()].flag }}
                    </span>
                  </div>

                  <!-- Disponible (hero) -->
                  <div class="flex flex-col gap-0.5 mb-5">
                    <span class="text-label-medium text-on-surface-variant">
                      {{ 'completeProfile.summary.available' | transloco }}
                    </span>
                    <span
                      class="text-display-small font-bold tracking-tight tabular-nums ph-no-capture leading-none"
                      [class.text-primary]="isSurplus"
                      [class.text-error]="!isSurplus"
                    >
                      {{
                        summary.available
                          | appCurrency: selectedCurrency() : '1.0-0'
                      }}
                    </span>
                  </div>

                  <!-- Progress bar: committed / income -->
                  <div class="relative h-1 w-full mb-4" aria-hidden="true">
                    <div
                      class="absolute inset-0 rounded-full bg-outline-variant/40"
                    ></div>
                    <div
                      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-emphasized"
                      [class.bg-primary]="isSurplus"
                      [class.bg-error]="!isSurplus"
                      [style.width.%]="committedPercent()"
                    ></div>
                  </div>

                  <!-- Breakdown inline -->
                  <div
                    class="flex items-center justify-between text-body-small text-on-surface-variant tabular-nums"
                  >
                    <span>
                      {{ 'completeProfile.summary.income' | transloco }}
                      <span class="text-on-surface font-medium ph-no-capture">
                        {{
                          summary.income
                            | appCurrency: selectedCurrency() : '1.0-0'
                        }}
                      </span>
                    </span>
                    <span aria-hidden="true" class="opacity-40">·</span>
                    <span>
                      {{ 'completeProfile.summary.committed' | transloco }}
                      <span class="text-on-surface font-medium ph-no-capture">
                        {{
                          summary.committed
                            | appCurrency: selectedCurrency() : '1.0-0'
                        }}
                      </span>
                    </span>
                  </div>

                  @if (!isSurplus) {
                    <p
                      class="text-body-small text-on-surface-variant mt-4 pt-4 border-t border-outline-variant/40"
                    >
                      {{ 'completeProfile.summary.deficitHint' | transloco }}
                    </p>
                  }
                </div>
              </aside>
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
  readonly #postHogService = inject(PostHogService);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #featureFlags = inject(FeatureFlagsService);

  readonly #locale = inject(LOCALE_ID);
  protected readonly suggestions = ONBOARDING_SUGGESTIONS;
  protected readonly maxCustomTransactions = MAX_CUSTOM_TRANSACTIONS;
  protected readonly currencies = SUPPORTED_CURRENCIES;
  protected readonly currencyMetadata = CURRENCY_METADATA;
  protected readonly stepperSteps = [
    { number: 1 as const, labelKey: 'completeProfile.stepYou' },
    { number: 2 as const, labelKey: 'completeProfile.stepYourExpenses' },
  ];
  protected readonly currentMonthLabel = new Date().toLocaleDateString(
    this.#locale,
    { month: 'long' },
  );

  protected formatAmount(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const locale = CURRENCY_CONFIG[this.selectedCurrency()].numberLocale;
    return value.toLocaleString(locale, { maximumFractionDigits: 0 });
  }

  protected labelKeyForType(type: 'income' | 'expense' | 'saving'): string {
    const keys = {
      income: 'completeProfile.customExpense.kindIncome',
      expense: 'completeProfile.customExpense.kindExpense',
      saving: 'completeProfile.customExpense.kindSaving',
    } as const;
    return keys[type];
  }

  protected readonly liveBudgetAnnouncement = computed(() => {
    const { available } = this.store.budgetSummary();
    const amount = this.formatAmount(Math.abs(available));
    return available < 0
      ? this.#transloco.translate(
          'completeProfile.summary.liveDeficitAnnouncement',
          { amount },
        )
      : this.#transloco.translate(
          'completeProfile.summary.liveAvailableAnnouncement',
          { amount },
        );
  });

  protected readonly isMultiCurrencyEnabled =
    this.#featureFlags.isMultiCurrencyEnabled;
  protected readonly showCurrencySelector = computed(
    () =>
      this.#featureFlags.isMultiCurrencyEnabled() &&
      this.#userSettings.showCurrencySelector(),
  );
  protected readonly selectedCurrency = signal<SupportedCurrency>(
    this.#userSettings.currency(),
  );
  protected readonly currentStep = signal<1 | 2>(1);

  protected readonly availableDays = Array.from(
    { length: PAY_DAY_MAX },
    (_, i) => i + 1,
  );

  protected readonly payDayLabel = computed(() => {
    const day = this.store.payDayOfMonth();
    return day === null
      ? null
      : this.#transloco.translate('completeProfile.preview.payDayOn', { day });
  });

  protected readonly ctaLabel = computed(() => {
    if (!this.store.firstName().trim()) {
      return 'completeProfile.ctaMissingName';
    }
    const income = this.store.monthlyIncome();
    if (income === null || income <= 0) {
      return 'completeProfile.ctaMissingIncome';
    }
    return 'completeProfile.ctaReady';
  });

  protected readonly committedPercent = computed(() => {
    const { income, committed } = this.store.budgetSummary();
    if (income <= 0) return 0;
    return Math.min(Math.round((committed / income) * 100), 100);
  });

  protected readonly hasAvailableSurplus = computed(
    () => this.store.budgetSummary().available >= 0,
  );

  constructor() {
    void this.#initPage();
  }

  async #initPage(): Promise<void> {
    const hasExisting = await this.store.checkExistingBudgets();
    if (hasExisting) {
      this.#router.navigate(['/', ROUTES.DASHBOARD]);
      return;
    }
    // Only prefill the form for users who are actually staying on this page.
    // Previously this ran in the constructor, which mutated a now-orphan store
    // for users redirected away by `hasExisting`.
    this.store.prefillFromOAuthMetadata();
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

  // Bound to (change), not (input), so the live budget preview only recomputes
  // when the user commits an edit (blur/Enter). Avoids jitter and unnecessary
  // sr-only re-announcements during typing. The live announcer (T2.6) updates
  // immediately on chip toggle and on this commit, which is the right moment.
  protected onAmountChange(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    if (Number.isFinite(value) && value > 0) {
      this.store.updateCustomTransactionAmount(index, value);
    } else {
      input.value = String(this.store.customTransactions()[index].amount);
    }
  }

  protected removeTransaction(index: number): void {
    this.store.removeCustomTransaction(index);
  }

  protected async openAddCustomDialog(): Promise<void> {
    const { AddCustomExpenseDialog } =
      await import('./add-custom-expense-dialog');
    const tx = await firstValueFrom(
      this.#dialog
        .open(AddCustomExpenseDialog, {
          width: '400px',
          data: { currency: this.selectedCurrency() },
        })
        .afterClosed(),
    );
    if (tx) this.store.addCustomTransaction(tx);
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
      this.store.leasingCredit() !== null;

    const event = hasAnyCharge
      ? 'profile_step2_completed'
      : 'profile_step2_skipped';
    this.#postHogService.captureEvent(event);
  }
}
