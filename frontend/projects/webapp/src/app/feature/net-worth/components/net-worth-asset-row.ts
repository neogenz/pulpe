import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { differenceInCalendarDays } from 'date-fns';
import type { Asset, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { formatEntryDate } from './entry-date';

export type AssetRowAction =
  | 'edit'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'setDefault'
  | 'unsetDefault';

export interface AssetRowEvent {
  asset: Asset;
  action: AssetRowAction;
}

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

@Component({
  selector: 'pulpe-net-worth-asset-row',
  host: {
    class: 'flex flex-wrap items-center border-t border-outline-variant pr-2',
    'data-testid': 'asset-row',
  },
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatRippleModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  providers: [AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The row and its menu are siblings: a button never holds a button. -->
    @if (asset().archivedAt) {
      <div class="summary">
        <ng-container [ngTemplateOutlet]="summary" />
      </div>
    } @else {
      <button
        type="button"
        class="summary summary-action"
        matRipple
        [disabled]="busy()"
        (click)="emit('edit')"
        data-testid="asset-row-edit-button"
      >
        <ng-container [ngTemplateOutlet]="summary" />
      </button>
    }
    <ng-template #summary>
      <span class="flex flex-wrap items-center gap-2 min-w-0 flex-1">
        <span
          class="ph-no-capture min-w-0 truncate text-body-large font-semibold"
          data-testid="asset-row-name"
          >{{ asset().name }}</span
        >
        @if (isDefault()) {
          <span class="chip chip-default" data-testid="asset-default-chip">{{
            'netWorth.account.defaultBadge' | transloco
          }}</span>
        }
        @if (isOverdraft()) {
          <span class="chip chip-amber" data-testid="asset-overdraft-chip">{{
            'netWorth.overdraft' | transloco
          }}</span>
        }
      </span>

      <span class="block text-right">
        <span
          class="ph-no-capture block whitespace-nowrap text-title-medium font-bold tabular-nums"
          [class.amber]="isDebt()"
          data-testid="asset-row-value"
        >
          {{ asset().latestValue | appCurrency: asset().currency : '1.2-2' }}
        </span>
        @if (asset().currency !== baseCurrency()) {
          <span
            class="ph-no-capture block text-body-small text-on-surface-variant tabular-nums"
            data-testid="asset-row-converted"
          >
            @if (asset().convertedValue !== null) {
              ≈
              {{
                asset().convertedValue | appCurrency: baseCurrency() : '1.2-2'
              }}
            } @else if (!asset().archivedAt) {
              {{ 'netWorth.excluded' | transloco }}
            }
          </span>
        }
      </span>
      <!-- Under the whole row: beside the amount, it would wrap on a phone. -->
      <span
        class="ph-no-capture block w-full text-body-small text-on-surface-variant"
        data-testid="asset-row-meta"
      >
        @if (sinceEntry(); as since) {
          @if (categoryName(); as category) {
            {{
              'netWorth.sinceEntryDebt'
                | transloco
                  : { category, amount: since.amount, date: since.date }
            }}
          } @else {
            {{ 'netWorth.sinceEntry' | transloco: since }}
          }
        } @else if (categoryName(); as category) {
          {{
            'netWorth.updatedDebt'
              | transloco: { category, when: updatedWhen() }
          }}
        } @else {
          {{ 'netWorth.updated' | transloco: { when: updatedWhen() } }}
        }
        <!-- A followed account says where its balance comes from, in the same breath. -->
        @if (asset().inPulpe) {
          <span data-testid="asset-linked-note">{{
            'netWorth.linkedSuffix' | transloco
          }}</span>
        }
      </span>
    </ng-template>

    <button
      matIconButton
      [matMenuTriggerFor]="menu"
      [disabled]="busy()"
      [attr.aria-label]="
        'netWorth.menu.actions' | transloco: { name: asset().name }
      "
      data-testid="asset-row-menu-button"
    >
      <mat-icon>more_vert</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      @if (asset().archivedAt) {
        <button
          mat-menu-item
          (click)="emit('unarchive')"
          data-testid="asset-unarchive-action"
        >
          <mat-icon>unarchive</mat-icon>
          <span>{{ 'netWorth.menu.unarchive' | transloco }}</span>
        </button>
      } @else {
        <button
          mat-menu-item
          (click)="emit('edit')"
          data-testid="asset-edit-action"
        >
          <mat-icon>edit</mat-icon>
          <span>{{ 'netWorth.menu.edit' | transloco }}</span>
        </button>
        <!-- The default account of the budget: one at a time, set from here or from Réglages. -->
        <button
          mat-menu-item
          (click)="emit(isDefault() ? 'unsetDefault' : 'setDefault')"
          data-testid="asset-default-action"
        >
          <mat-icon>{{ isDefault() ? 'star' : 'star_border' }}</mat-icon>
          <span>{{
            (isDefault()
              ? 'netWorth.menu.unsetDefault'
              : 'netWorth.menu.setDefault'
            ) | transloco
          }}</span>
        </button>
        <button
          mat-menu-item
          (click)="emit('archive')"
          data-testid="asset-archive-action"
        >
          <mat-icon>archive</mat-icon>
          <span>{{ 'netWorth.menu.archive' | transloco }}</span>
        </button>
      }
      <mat-divider />
      <button
        mat-menu-item
        class="text-error"
        (click)="emit('delete')"
        data-testid="asset-delete-action"
      >
        <mat-icon class="text-error">delete</mat-icon>
        <span>{{ 'netWorth.menu.delete' | transloco }}</span>
      </button>
    </mat-menu>
  `,
  styles: `
    .summary {
      display: flex;
      min-width: 0;
      flex: 1;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.125rem 0.75rem;
      padding: 0.75rem 0.25rem 0.75rem 1.25rem;
      text-align: left;
      color: inherit;
    }
    .summary-action {
      position: relative;
      cursor: pointer;
    }
    @media (hover: hover) {
      :host:hover:has(.summary-action:enabled) {
        background: color-mix(
          in srgb,
          var(--mat-sys-on-surface) 8%,
          transparent
        );
      }
    }
    :host:has(.summary-action:focus-visible) {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .summary-action:focus-visible {
      outline: none;
    }
    .chip {
      border-radius: 9999px;
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .chip-default {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .chip-amber {
      background: var(--pulpe-amber-container);
      color: var(--pulpe-amber-on-container);
    }
    .amber {
      color: var(--pulpe-amber);
    }
  `,
})
export class NetWorthAssetRow {
  readonly #locale = inject(LOCALE_ID);
  readonly #currencyPipe = inject(AppCurrencyPipe);
  readonly #relativeTime = new Intl.RelativeTimeFormat(this.#locale, {
    numeric: 'auto',
  });

  readonly asset = input.required<Asset>();
  readonly baseCurrency = input.required<SupportedCurrency>();
  /** Set on rows of the debts section, which name the category in their meta line. */
  readonly categoryName = input<string | null>(null);
  /** The account new movements start on (CA47): shows the badge and flips the menu entry. */
  readonly isDefault = input(false);
  readonly busy = input(false);
  readonly action = output<AssetRowEvent>();

  // An overdrawn `own` account is counted on the debts side by the API.
  protected readonly isOverdraft = computed(
    () => this.asset().direction === 'own' && this.asset().latestValue < 0,
  );
  protected readonly isDebt = computed(
    () => this.asset().direction === 'owe' || this.isOverdraft(),
  );

  /** What was checked since my last entry, e.g. « +500.00 CHF depuis ta saisie du 3 novembre ». */
  protected readonly sinceEntry = computed(() => {
    const { latestValue, recordedValue, latestRecordedAt, currency } =
      this.asset();
    const deltaCents =
      Math.round(latestValue * 100) - Math.round(recordedValue * 100);
    if (deltaCents === 0) return null;
    const amount = `${deltaCents < 0 ? '−' : '+'}${this.#currencyPipe.transform(
      Math.abs(deltaCents) / 100,
      currency,
      '1.2-2',
    )}`;
    const date = formatEntryDate(latestRecordedAt, this.#locale);
    return { amount, date };
  });

  protected readonly updatedWhen = computed(() => {
    const days = differenceInCalendarDays(
      new Date(),
      new Date(this.asset().latestRecordedAt),
    );
    if (days >= DAYS_PER_YEAR) {
      return this.#relativeTime.format(
        -Math.floor(days / DAYS_PER_YEAR),
        'year',
      );
    }
    if (days >= DAYS_PER_MONTH) {
      return this.#relativeTime.format(
        -Math.floor(days / DAYS_PER_MONTH),
        'month',
      );
    }
    return this.#relativeTime.format(-days, 'day');
  });

  protected emit(action: AssetRowAction): void {
    this.action.emit({ asset: this.asset(), action });
  }
}
