import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Asset, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { type AssetRowEvent, NetWorthAssetRow } from './net-worth-asset-row';

/** A tonal card of asset rows: one per Type on each side, plus the archives. */
@Component({
  selector: 'pulpe-net-worth-section',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    AppCurrencyPipe,
    NetWorthAssetRow,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="overflow-hidden rounded-2xl bg-surface-container-low"
      [attr.aria-label]="title()"
      data-testid="net-worth-section"
    >
      <header class="flex min-h-14 items-center gap-3 pl-5 pr-2">
        <h3
          class="ph-no-capture min-w-0 flex-1 truncate text-title-medium font-semibold"
        >
          {{ title() }}
        </h3>
        @if (total() !== null) {
          <span
            class="ph-no-capture whitespace-nowrap text-label-large font-semibold tabular-nums"
            [class.amber]="isDebts()"
            [class.text-on-surface-variant]="!isDebts()"
            [class.mr-3]="!renamable()"
            data-testid="net-worth-section-total"
          >
            {{ total() | appCurrency: baseCurrency() : '1.0-0' }}
          </span>
        }
        @if (renamable()) {
          <button
            matIconButton
            [matMenuTriggerFor]="typeMenu"
            [disabled]="busy()"
            [attr.aria-label]="
              'netWorth.type.menu' | transloco: { name: title() }
            "
            data-testid="net-worth-type-menu-button"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #typeMenu="matMenu">
            <button
              mat-menu-item
              (click)="rename.emit()"
              data-testid="net-worth-type-rename-action"
            >
              <mat-icon>edit</mat-icon>
              <span>{{ 'netWorth.type.rename' | transloco }}</span>
            </button>
          </mat-menu>
        }
      </header>
      <ul class="m-0 list-none p-0">
        @for (asset of assets(); track asset.id) {
          <li>
            <pulpe-net-worth-asset-row
              [asset]="asset"
              [baseCurrency]="baseCurrency()"
              [busy]="busy()"
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
  /** Base-currency subtotal; `null` hides it (archives are in no total). */
  readonly total = input<number | null>(null);
  readonly assets = input.required<readonly Asset[]>();
  readonly baseCurrency = input.required<SupportedCurrency>();
  readonly isDebts = input(false);
  /** A Type can be renamed from its header; the overdrafts and the archives are not Types. */
  readonly renamable = input(false);
  /** The archives and the overdrafts mix Types, so their rows name theirs. */
  readonly showCategory = input(false);
  readonly categoryNames = input<ReadonlyMap<string, string>>(new Map());
  /** A write is in flight: the rows' quick actions wait for it. */
  readonly busy = input(false);
  readonly action = output<AssetRowEvent>();
  readonly rename = output<void>();
}
