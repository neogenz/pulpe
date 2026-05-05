import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { Field, form, max, min, required } from '@angular/forms/signals';
import {
  AppCurrencyPipe,
  CURRENCY_CONFIG,
  CurrencyConverterService,
  type FetchRateResult,
} from '@core/currency';
import { CurrencyConversionBadge } from '@ui/currency-conversion-badge';
import type { SupportedCurrency } from 'pulpe-shared';

const CONVERTER_AMOUNT_MAX = 100_000_000;

/** Montant saisi dans le convertisseur (Signal Forms). */
interface ConverterAmountModel {
  amount: number | null;
}

/**
 * Convertisseur de devises (paramètres).
 * Template: `[field]="$any(converterForm.amount)"` — le compilateur n’accepte pas encore
 * `number | null` pour les inputs number liés au Field signal (TS2322).
 */
@Component({
  selector: 'pulpe-currency-converter-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block',
  },
  imports: [
    AppCurrencyPipe,
    CurrencyConversionBadge,
    DecimalPipe,
    Field,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  template: `
    <div
      class="rounded-2xl bg-surface-container/50 p-5 border border-outline-variant space-y-4"
      data-testid="currency-converter"
    >
      <div class="flex items-center gap-3">
        <mat-icon class="text-on-surface-variant">currency_exchange</mat-icon>
        <span class="text-title-small font-medium">{{
          'settings.converterTitle' | transloco
        }}</span>
      </div>

      <div
        class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3"
      >
        <div class="min-w-0 w-full">
          <mat-form-field
            appearance="outline"
            subscriptSizing="dynamic"
            class="w-full"
          >
            <mat-label>{{
              'settings.converterAmountLabel' | transloco
            }}</mat-label>
            <input
              matInput
              type="number"
              inputmode="decimal"
              [field]="$any(converterForm.amount)"
              [errorStateMatcher]="converterAmountErrorMatcher"
              step="0.01"
              class="tabular-nums"
              data-testid="converter-amount-input"
            />
            <span matTextSuffix>{{ converterBaseSymbol() }}</span>
            @if (amountErroredKind() === 'max') {
              <mat-error data-testid="converter-amount-max-error">
                {{
                  'settings.converterAmountMaxError'
                    | transloco: { max: converterAmountMax }
                }}
              </mat-error>
            } @else if (amountErroredKind() === 'min') {
              <mat-error data-testid="converter-amount-min-error">
                {{ 'settings.converterAmountMinError' | transloco }}
              </mat-error>
            } @else if (amountErroredKind() === 'required') {
              <mat-error data-testid="converter-amount-required-error">
                {{ 'settings.converterAmountRequiredError' | transloco }}
              </mat-error>
            }
          </mat-form-field>
        </div>

        <div class="flex items-center justify-center shrink-0">
          <button
            matIconButton
            type="button"
            (click)="swapConverterDirection()"
            [attr.aria-label]="'settings.swapConversionAriaLabel' | transloco"
            data-testid="converter-swap-button"
          >
            <mat-icon class="!m-0 !block">swap_horiz</mat-icon>
          </button>
        </div>

        <div class="flex min-w-0 w-full items-center">
          <div
            class="min-w-0 w-full overflow-x-auto rounded-xl bg-surface-container-low p-3 text-center ph-no-capture"
          >
            @if (conversionResource.isLoading()) {
              <mat-progress-spinner
                mode="indeterminate"
                [diameter]="20"
                class="mx-auto"
              />
            } @else if (conversionResource.error()) {
              <p
                role="alert"
                class="text-body-small text-error px-1"
                data-testid="converter-rate-error"
              >
                {{ 'settings.converterRateFetchError' | transloco }}
              </p>
            } @else if (convertedAmount() !== null) {
              <p
                class="text-title-medium font-bold text-on-surface min-w-0 whitespace-nowrap tabular-nums"
                data-testid="converter-result"
              >
                {{
                  convertedAmount() | appCurrency: converterTarget() : '1.2-2'
                }}
              </p>
            }
          </div>
        </div>
      </div>

      @if (fallbackDate() !== null) {
        <div class="flex justify-center">
          <pulpe-currency-conversion-badge [fallbackDate]="fallbackDate()" />
        </div>
      }

      @if (rateForInfo() !== null) {
        <p
          class="text-body-small text-on-surface-variant text-center"
          data-testid="converter-rate-info"
        >
          {{
            'settings.converterRateInfo'
              | transloco
                : {
                    base: converterBase(),
                    rate: (rateForInfo()! | number: '1.3-3'),
                    target: converterTarget(),
                  }
          }}
        </p>
      }
    </div>
  `,
})
export class CurrencyConverterWidget {
  /**
   * Taux via `resource()` ; le chargement HTTP réel et le cache SWR sont dans
   * {@link CurrencyConverterService#fetchRate} (DataCache ngx-ziflux).
   */
  readonly #currencyConverter = inject(CurrencyConverterService);
  /** Plafond de saisie du montant dans le convertisseur. */
  readonly converterAmountMax = CONVERTER_AMOUNT_MAX;

  /**
   * Devise persistée (store). `undefined` uniquement avant la première liaison
   * parent — évite NG0950 avec `resource()` évalué à l’init de la classe.
   */
  readonly savedCurrency = input<SupportedCurrency | undefined>(undefined);
  /** Devise sélectionnée dans l’UI (brouillon). */
  readonly draftCurrency = input<SupportedCurrency | undefined>(undefined);

  readonly #amountModel = signal<ConverterAmountModel>({ amount: 100 });
  readonly converterForm = form(this.#amountModel, (path) => {
    required(path.amount);
    min(path.amount, 0);
    max(path.amount, CONVERTER_AMOUNT_MAX);
  });

  /**
   * Default Material matcher waits for touched/dirty; the converter should surface
   * signal-form errors as soon as the value is invalid.
   */
  protected readonly converterAmountErrorMatcher: ErrorStateMatcher = {
    isErrorState: () => this.converterForm.amount().invalid(),
  };

  protected readonly amountErroredKind = computed(() => {
    const errors = this.converterForm.amount().errors();
    if (!errors.length) return null;
    // Built-in rules emit subclasses with string `kind` ('max' | 'min' | 'required', …).
    if (errors.some((e) => e.kind === 'max')) return 'max' as const;
    if (errors.some((e) => e.kind === 'min')) return 'min' as const;
    if (errors.some((e) => e.kind === 'required')) return 'required' as const;
    return null;
  });

  protected readonly isConverterReversed = signal(false);

  readonly #pairReady = computed(() => {
    const s = this.savedCurrency();
    const d = this.draftCurrency();
    return s !== undefined && d !== undefined;
  });

  protected readonly converterBase = computed(() => {
    const s = this.savedCurrency();
    const d = this.draftCurrency();
    if (!this.#pairReady()) {
      return (s ?? 'CHF') as SupportedCurrency;
    }
    return this.isConverterReversed() ? d! : s!;
  });
  protected readonly converterTarget = computed(() => {
    const s = this.savedCurrency();
    const d = this.draftCurrency();
    if (!this.#pairReady()) {
      return (d ?? 'EUR') as SupportedCurrency;
    }
    return this.isConverterReversed() ? s! : d!;
  });
  protected readonly converterBaseSymbol = computed(
    () => CURRENCY_CONFIG[this.converterBase()].symbol,
  );

  /**
   * Clé stable pour `resource` ; `null` tant que le parent n’a pas lié les deux devises.
   * Inclut l’inversion (swap) pour recharger le taux dans le sens affiché (base → cible).
   */
  readonly #currencyPair = computed<{
    base: SupportedCurrency;
    target: SupportedCurrency;
  } | null>(() => {
    const s = this.savedCurrency();
    const d = this.draftCurrency();
    if (s === undefined || d === undefined) return null;
    return this.isConverterReversed()
      ? { base: d, target: s }
      : { base: s, target: d };
  });

  protected readonly conversionResource = resource<
    FetchRateResult | null | undefined,
    { base: SupportedCurrency; target: SupportedCurrency } | null
  >({
    params: () => this.#currencyPair(),
    loader: async ({ params }) => {
      if (params === null) return undefined;
      if (params.base === params.target) return null;
      return await this.#currencyConverter.fetchRate(
        params.base,
        params.target,
      );
    },
  });

  /** Résultat du fetch courant, ou `null` si indisponible (loading/error/no-pair). */
  readonly #fetchResult = computed<FetchRateResult | null>(() => {
    const r = this.conversionResource;
    if (r.error() || r.isLoading()) return null;
    if (!r.hasValue()) return null;
    const v = r.value();
    return v == null ? null : v;
  });

  /** Taux affiché sous le widget ; évite de lire `value()` quand la resource est en erreur. */
  protected readonly rateForInfo = computed(() => {
    return this.#fetchResult()?.rate ?? null;
  });

  /** Date de référence à afficher dans le badge fallback (null quand le fetch live a réussi). */
  protected readonly fallbackDate = computed(() => {
    const result = this.#fetchResult();
    if (!result?.fromFallback) return null;
    return result.cachedDate ?? null;
  });

  protected readonly convertedAmount = computed(() => {
    const result = this.#fetchResult();
    if (result == null) return null;
    const field = this.converterForm.amount();
    if (field.invalid()) return null;
    const amount = field.value();
    if (amount === null || Number.isNaN(amount)) return null;
    return this.#currencyConverter.convert(amount, result.rate);
  });

  swapConverterDirection(): void {
    this.isConverterReversed.update((v) => !v);
  }
}
