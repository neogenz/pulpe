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
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { differenceInCalendarDays } from 'date-fns';
import type { Asset, SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

export type AssetRowAction =
  | 'updateValue'
  | 'edit'
  | 'archive'
  | 'unarchive'
  | 'delete';

export interface AssetRowEvent {
  asset: Asset;
  action: AssetRowAction;
}

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

@Component({
  selector: 'pulpe-net-worth-asset-row',
  host: {
    class:
      'flex items-center gap-3 border-t border-outline-variant py-3 pl-5 pr-2',
    'data-testid': 'asset-row',
  },
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="ph-no-capture min-w-0 truncate text-body-large font-semibold"
          data-testid="asset-row-name"
          >{{ asset().name }}</span
        >
        @if (isOverdraft()) {
          <span class="chip chip-amber" data-testid="asset-overdraft-chip">{{
            'netWorth.overdraft' | transloco
          }}</span>
        }
        @if (asset().inPulpe) {
          <span class="chip chip-pulpe" data-testid="asset-in-pulpe-chip">{{
            'netWorth.inPulpe' | transloco
          }}</span>
        }
      </div>
      <p
        class="ph-no-capture text-body-small text-on-surface-variant"
        data-testid="asset-row-meta"
      >
        @if (categoryName(); as category) {
          {{
            'netWorth.updatedDebt'
              | transloco: { category, when: updatedWhen() }
          }}
        } @else {
          {{ 'netWorth.updated' | transloco: { when: updatedWhen() } }}
        }
      </p>
    </div>

    <div class="text-right">
      <p
        class="ph-no-capture whitespace-nowrap text-title-medium font-bold tabular-nums"
        [class.amber]="isDebt()"
        data-testid="asset-row-value"
      >
        {{ asset().latestValue | appCurrency: asset().currency : '1.2-2' }}
      </p>
      @if (asset().currency !== baseCurrency()) {
        <p
          class="ph-no-capture text-body-small text-on-surface-variant tabular-nums"
          data-testid="asset-row-converted"
        >
          @if (asset().convertedValue !== null) {
            ≈
            {{ asset().convertedValue | appCurrency: baseCurrency() : '1.2-2' }}
          } @else if (!asset().archivedAt) {
            {{ 'netWorth.excluded' | transloco }}
          }
        </p>
      }
    </div>

    <button
      matIconButton
      [matMenuTriggerFor]="menu"
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
          (click)="emit('updateValue')"
          data-testid="asset-update-value-action"
        >
          <mat-icon>edit_note</mat-icon>
          <span>{{ 'netWorth.menu.updateValue' | transloco }}</span>
        </button>
        <button
          mat-menu-item
          (click)="emit('edit')"
          data-testid="asset-edit-action"
        >
          <mat-icon>edit</mat-icon>
          <span>{{ 'netWorth.menu.edit' | transloco }}</span>
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
    .chip {
      border-radius: 9999px;
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .chip-pulpe {
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
  readonly #relativeTime = new Intl.RelativeTimeFormat(this.#locale, {
    numeric: 'auto',
  });

  readonly asset = input.required<Asset>();
  readonly baseCurrency = input.required<SupportedCurrency>();
  /** Set on rows of the debts section, which name the category in their meta line. */
  readonly categoryName = input<string | null>(null);
  readonly action = output<AssetRowEvent>();

  // An overdrawn `own` account is counted on the debts side by the API.
  protected readonly isOverdraft = computed(
    () => this.asset().direction === 'own' && this.asset().latestValue < 0,
  );
  protected readonly isDebt = computed(
    () => this.asset().direction === 'owe' || this.isOverdraft(),
  );

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
