import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import type { Asset, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { type AssetRowEvent, NetWorthAssetRow } from './net-worth-asset-row';

/** A titled card of asset rows: one per category, plus debts and archives. */
@Component({
  selector: 'pulpe-net-worth-section',
  imports: [AppCurrencyPipe, NetWorthAssetRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="overflow-hidden rounded-2xl border border-outline-variant"
      [attr.aria-label]="title()"
      data-testid="net-worth-section"
    >
      <header class="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
        <h3
          class="ph-no-capture min-w-0 truncate text-title-medium font-semibold"
        >
          {{ title() }}
        </h3>
        @if (total() !== null) {
          <span
            class="ph-no-capture whitespace-nowrap text-label-large font-semibold tabular-nums"
            [class.amber]="isDebts()"
            [class.text-on-surface-variant]="!isDebts()"
            data-testid="net-worth-section-total"
          >
            {{ total() | appCurrency: baseCurrency() : '1.0-0' }}
          </span>
        }
      </header>
      <ul class="m-0 list-none p-0">
        @for (asset of assets(); track asset.id) {
          <li>
            <pulpe-net-worth-asset-row
              [asset]="asset"
              [baseCurrency]="baseCurrency()"
              [categoryName]="
                showCategory()
                  ? (categoryNames().get(asset.categoryId) ?? null)
                  : null
              "
              (action)="action.emit($event)"
            />
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .amber {
      color: var(--pulpe-amber);
    }
  `,
})
export class NetWorthSection {
  readonly title = input.required<string>();
  /** Base-currency subtotal from the API; `null` hides it (archives are in no total). */
  readonly total = input<number | null>(null);
  readonly assets = input.required<readonly Asset[]>();
  readonly baseCurrency = input.required<SupportedCurrency>();
  readonly isDebts = input(false);
  /** Debts and archives mix categories, so their rows name the category. */
  readonly showCategory = input(false);
  readonly categoryNames = input<ReadonlyMap<string, string>>(new Map());
  readonly action = output<AssetRowEvent>();
}
