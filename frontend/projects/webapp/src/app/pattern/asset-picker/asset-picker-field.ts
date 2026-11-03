import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { cachedResource } from 'ngx-ziflux';
import { map } from 'rxjs';
import type { AssetDirection, TransactionKind } from 'pulpe-shared';

import { AssetApi, NET_WORTH_CACHE_KEY } from '@core/asset/asset-api';

/**
 * Which assets a prévision of this kind can be linked to: an Épargne lands on
 * something I own, a Dépense repays something I owe. A Revenu has no field of
 * its own: it only gets the picker through its origin « Tiré de mon patrimoine »
 * (`kind="income"`, `direction="own"`). Mirrors the `asset_id` guard trigger,
 * which refuses any other pairing.
 */
export function assetDirectionForKind(
  kind: TransactionKind,
): AssetDirection | null {
  if (kind === 'saving') return 'own';
  if (kind === 'expense') return 'owe';
  return null;
}

/**
 * The net-worth read the picker and the dialogs share. Same key and loader as
 * NetWorthStore: one request for the page, the reconciliation and every
 * consumer. Call it from an injection context.
 */
export function injectNetWorthResource() {
  const api = inject(AssetApi);
  return cachedResource({
    cache: api.cache,
    cacheKey: NET_WORTH_CACHE_KEY,
    loader: () => api.getNetWorth$().pipe(map((response) => response.data)),
  });
}

/**
 * « Versée sur » / « Dette remboursée » / « Tiré de » picker: the asset a
 * prévision feeds or is drawn from.
 *
 * Value-based like the savings-goal picker: the caller passes the current
 * `assetId` via `[value]` and reacts to `(valueChanged)`; the first option maps
 * to `null`. The list is the active assets of one `direction`, read from the
 * cache « Mon patrimoine » already fills. The field renders nothing while the
 * list loads, fails (the HTTP interceptor already reports it) or has nothing to
 * offer, so a dialog never carries a dead field. A linked asset archived since
 * stays listed, otherwise the select would show the link as empty.
 */
@Component({
  selector: 'pulpe-asset-picker-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [MatFormFieldModule, MatSelectModule, TranslocoPipe],
  template: `
    @if (options().length > 0) {
      <mat-form-field
        appearance="outline"
        subscriptSizing="dynamic"
        class="w-full"
      >
        <mat-label>{{ labelKey() | transloco }}</mat-label>
        <mat-select
          [value]="value()"
          (selectionChange)="valueChanged.emit($event.value)"
          data-testid="asset-picker-select"
        >
          <!-- The category only helps tell options apart in the list. -->
          <mat-select-trigger>
            <span class="ph-no-capture">{{ selectedOption()?.name }}</span>
          </mat-select-trigger>
          <mat-option [value]="null">{{
            'netWorth.link.none' | transloco
          }}</mat-option>
          @for (option of options(); track option.id) {
            <mat-option
              [value]="option.id"
              [attr.data-testid]="'asset-picker-option-' + option.id"
            >
              <span class="ph-no-capture">{{ option.name }}</span>
              <span class="ph-no-capture text-on-surface-variant">
                · {{ option.category }}
              </span>
            </mat-option>
          }
        </mat-select>
        @if (hint(); as copy) {
          <mat-hint class="ph-no-capture" data-testid="asset-picker-hint">{{
            copy.key | transloco: copy.params
          }}</mat-hint>
        }
      </mat-form-field>
    }
  `,
})
export class AssetPickerField {
  readonly direction = input.required<AssetDirection>();
  /** `income` for a Revenu drawn from an asset; the other kinds derive from `direction`. */
  readonly kind = input<TransactionKind | null>(null);
  readonly value = input<string | null>(null);
  readonly valueChanged = output<string | null>();

  readonly #netWorth = injectNetWorthResource();

  protected readonly labelKey = computed(() => {
    if (this.kind() === 'income') return 'netWorth.link.drawnLabel';
    return this.direction() === 'own'
      ? 'netWorth.link.ownLabel'
      : 'netWorth.link.oweLabel';
  });

  protected readonly options = computed(() => {
    const netWorth = this.#netWorth.value();
    if (!netWorth) return [];
    const categoryNames = new Map(
      netWorth.categories.map((category) => [category.id, category.name]),
    );
    return netWorth.assets
      .filter(
        (asset) =>
          asset.direction === this.direction() &&
          (asset.archivedAt === null || asset.id === this.value()),
      )
      .map((asset) => ({
        id: asset.id,
        name: asset.name,
        category: categoryNames.get(asset.categoryId) ?? '',
      }));
  });

  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.id === this.value()) ?? null,
  );

  // An Épargne on an asset has no hint: only the two flows that lower a value do.
  protected readonly hint = computed(() => {
    const selected = this.selectedOption();
    if (!selected) return null;
    if (this.kind() === 'income') {
      return {
        key: 'netWorth.link.drawnHint',
        params: { asset: selected.name },
      };
    }
    return this.direction() === 'owe'
      ? { key: 'netWorth.link.oweHint', params: { debt: selected.name } }
      : null;
  });
}
