import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  resource,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset, SupportedCurrency } from 'pulpe-shared';
import { CURRENCY_CONFIG, CurrencyConverterService } from '@core/currency';

/**
 * « Livret EUR converti au taux du jour : 1 EUR = 0.9391 CHF ». The API owns
 * every converted amount; this only shows the rate behind them. A rate that
 * cannot be fetched drops its note rather than blocking the page.
 */
@Component({
  selector: 'pulpe-net-worth-fx-notes',
  imports: [MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (note of rates.value() ?? []; track note.currency) {
      <p
        class="ph-no-capture m-0 flex items-center gap-1.5 text-body-small text-on-surface-variant"
        data-testid="net-worth-fx-note"
      >
        <mat-icon class="mat-icon-sm" aria-hidden="true"
          >currency_exchange</mat-icon
        >
        {{
          'netWorth.fxNote'
            | transloco
              : {
                  asset: note.names,
                  foreign: note.currency,
                  rate: note.rate,
                  base: baseCurrency(),
                }
        }}
      </p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }
  `,
})
export class NetWorthFxNotes {
  readonly #converter = inject(CurrencyConverterService);
  readonly #listFormat = new Intl.ListFormat(inject(LOCALE_ID), {
    style: 'long',
    type: 'conjunction',
  });

  readonly assets = input.required<readonly Asset[]>();
  readonly baseCurrency = input.required<SupportedCurrency>();

  readonly #foreign = computed(() => {
    const base = this.baseCurrency();
    const namesByCurrency = new Map<SupportedCurrency, string[]>();
    for (const asset of this.assets()) {
      if (asset.currency === base || asset.convertedValue === null) continue;
      namesByCurrency.set(asset.currency, [
        ...(namesByCurrency.get(asset.currency) ?? []),
        asset.name,
      ]);
    }
    return [...namesByCurrency].map(([currency, names]) => ({
      currency,
      names: this.#listFormat.format(names),
    }));
  });

  protected readonly rates = resource({
    params: () => ({ foreign: this.#foreign(), base: this.baseCurrency() }),
    loader: async ({ params }) => {
      const settled = await Promise.allSettled(
        params.foreign.map(async (entry) => ({
          ...entry,
          // The rate reads in the base currency's locale, like the amounts
          // beside it: « 0.9166 » for CHF, « 1,0910 » for EUR.
          rate: formatNumber(
            (await this.#converter.fetchRate(entry.currency, params.base)).rate,
            CURRENCY_CONFIG[params.base].numberLocale,
            '1.4-4',
          ),
        })),
      );
      return settled.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
    },
  });
}
