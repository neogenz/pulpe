import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgTemplateOutlet, PercentPipe } from '@angular/common';
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
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    AppCurrencyPipe,
    PercentPipe,
    NetWorthAssetRow,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="overflow-hidden rounded-2xl bg-surface-container-low"
      [attr.aria-label]="title()"
      data-testid="net-worth-section"
    >
      <header
        class="flex min-h-14 items-center gap-3 pr-2"
        [class.pl-5]="collapsed() === null"
      >
        @if (collapsed() === null) {
          <h3 class="min-w-0 flex-1">
            <ng-container [ngTemplateOutlet]="heading" />
          </h3>
        } @else {
          <h3 class="min-w-0 flex-1">
            <button
              type="button"
              class="section-toggle flex min-h-14 w-full cursor-pointer items-center gap-3 pl-3 text-left"
              [attr.aria-expanded]="!collapsed()"
              (click)="toggleCollapsed.emit()"
              data-testid="net-worth-section-toggle"
            >
              <mat-icon
                aria-hidden="true"
                class="shrink-0 text-on-surface-variant transition-transform"
                [class.-rotate-90]="collapsed()"
                >expand_more</mat-icon
              >
              <ng-container [ngTemplateOutlet]="heading" />
            </button>
          </h3>
        }
        <ng-template #heading>
          <span class="flex min-w-0 flex-1 items-center gap-3">
            <span
              class="ph-no-capture min-w-0 flex-1 truncate text-title-medium font-semibold"
            >
              {{ title() }}
            </span>
            @if (total() !== null) {
              <span
                class="flex min-w-0 flex-wrap items-baseline justify-end gap-x-1"
                [class.mr-3]="!renamable()"
              >
                <span
                  class="ph-no-capture whitespace-nowrap text-label-large font-semibold tabular-nums"
                  [class.amber]="isDebts()"
                  [class.text-on-surface-variant]="!isDebts()"
                  data-testid="net-worth-section-total"
                >
                  {{ total() | appCurrency: baseCurrency() : '1.0-0' }}
                </span>
                @if (ownedShare() | percent: '1.0-0'; as share) {
                  <span
                    class="ph-no-capture text-label-medium text-on-surface-variant tabular-nums"
                    data-testid="net-worth-section-share"
                  >
                    <span aria-hidden="true">· {{ share }}</span>
                    <span class="sr-only">{{
                      'netWorth.type.shareOfOwned'
                        | transloco: { percent: share }
                    }}</span>
                  </span>
                }
              </span>
            }
          </span>
        </ng-template>
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
      @if (!collapsed()) {
        <ul class="m-0 list-none p-0">
          @for (asset of assets(); track asset.id) {
            <li>
              <pulpe-net-worth-asset-row
                [asset]="asset"
                [baseCurrency]="baseCurrency()"
                [busy]="busy()"
                [isDefault]="asset.id === defaultAccountId()"
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
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    @media (hover: hover) {
      header:hover:has(.section-toggle) {
        background: color-mix(
          in srgb,
          var(--mat-sys-on-surface) 8%,
          transparent
        );
      }
    }
    header:has(.section-toggle:focus-visible) {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .section-toggle:focus-visible {
      outline: none;
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
  /** Share of « Ce que j'ai »; `null` hides it (debts, archives, a lone Type). */
  readonly ownedShare = input<number | null>(null);
  readonly assets = input.required<readonly Asset[]>();
  readonly baseCurrency = input.required<SupportedCurrency>();
  readonly isDebts = input(false);
  /** A Type can be renamed from its header; the overdrafts and the archives are not Types. */
  readonly renamable = input(false);
  /** The archives and the overdrafts mix Types, so their rows name theirs. */
  readonly showCategory = input(false);
  readonly categoryNames = input<ReadonlyMap<string, string>>(new Map());
  /** A write is in flight: the rows' quick actions wait for it. */
  readonly defaultAccountId = input<string | null>(null);
  readonly busy = input(false);
  /** `null` keeps the card open for good (the archives already sit behind their own toggle). */
  readonly collapsed = input<boolean | null>(null);
  readonly action = output<AssetRowEvent>();
  readonly toggleCollapsed = output<void>();
  readonly rename = output<void>();
}
