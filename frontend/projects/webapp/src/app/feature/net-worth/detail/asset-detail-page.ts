import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  input,
  LOCALE_ID,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { SupportedCurrency } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { ROUTES } from '@core/routing';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { formatEntryDate } from '../components/entry-date';
import { NetWorthDialogService } from '../services/net-worth-dialog.service';
import { NetWorthStore } from '../services/net-worth-store';
import { injectWriteAttempt } from '../services/write-attempt';
import { AssetHistoryStore } from './asset-history-store';

type DetailViewState = 'loading' | 'error' | 'notFound' | 'ready';

/**
 * One asset and everything that made its value: my entries and the movements
 * I checked, newest first, as the server computed them. Nothing is summed here.
 */
@Component({
  selector: 'pulpe-asset-detail-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    BaseLoading,
    StateCard,
  ],
  providers: [AssetHistoryStore, AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-w-0 flex-col gap-6" data-testid="asset-detail-page">
      <header class="flex min-w-0 items-center gap-2">
        <button
          matIconButton
          (click)="goBack()"
          [attr.aria-label]="'netWorth.detail.back' | transloco"
          data-testid="asset-detail-back-button"
        >
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1
          class="ph-no-capture min-w-0 flex-shrink truncate text-headline-medium font-bold md:text-display-small"
          data-testid="page-title"
        >
          {{ asset()?.name }}
        </h1>
        @if (viewState() === 'ready') {
          <!-- An icon on a phone: the labelled button would leave the name a few letters. -->
          <!-- Wrapped: a Material button's own display beats a hiding utility. -->
          <div class="ml-auto shrink-0 md:hidden">
            <button
              matIconButton
              [disabled]="!netWorth.netWorth.hasValue() || netWorth.isSaving()"
              [attr.aria-label]="'netWorth.menu.edit' | transloco"
              (click)="onEdit()"
              data-testid="asset-detail-edit-icon-button"
            >
              <mat-icon>edit</mat-icon>
            </button>
          </div>
          <div class="ml-auto hidden shrink-0 md:block">
            <button
              matButton="outlined"
              [disabled]="!netWorth.netWorth.hasValue() || netWorth.isSaving()"
              (click)="onEdit()"
              data-testid="asset-detail-edit-button"
            >
              <mat-icon>edit</mat-icon>
              {{ 'netWorth.menu.edit' | transloco }}
            </button>
          </div>
        }
      </header>

      @switch (viewState()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'common.loading' | transloco"
            size="large"
            testId="asset-detail-loading"
          />
        }
        @case ('notFound') {
          <pulpe-state-card
            variant="empty"
            [title]="'netWorth.detail.notFound' | transloco"
            [actionLabel]="'netWorth.detail.back' | transloco"
            (action)="goBack()"
            testId="asset-detail-not-found"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'common.error' | transloco"
            [message]="'netWorth.detail.loadError' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="history.reload()"
            testId="asset-detail-error"
          />
        }
        @default {
          <section
            class="flex flex-col gap-1"
            data-testid="asset-detail-summary"
          >
            @if (categoryName(); as category) {
              <p
                class="ph-no-capture m-0 text-label-large text-on-surface-variant"
                data-testid="asset-detail-type"
              >
                {{ category }}
              </p>
            }
            <p
              class="ph-no-capture m-0 text-display-small font-extrabold tabular-nums"
              [class.amber]="isDebt()"
              data-testid="asset-detail-value"
            >
              {{ value() }}
            </p>
            <p
              class="ph-no-capture m-0 text-body-medium text-on-surface-variant"
              data-testid="asset-detail-last-entry"
            >
              {{ lastEntry() }}
            </p>
          </section>

          <section
            class="flex min-w-0 flex-col gap-3"
            aria-labelledby="asset-history-title"
          >
            <h2
              id="asset-history-title"
              class="m-0 text-title-large font-semibold"
            >
              {{ 'netWorth.detail.history' | transloco }}
            </h2>
            @if (isNothingSince()) {
              <p
                class="m-0 flex items-start gap-3 rounded-2xl bg-surface-container p-4 text-body-medium"
                data-testid="asset-detail-nothing-since"
              >
                <mat-icon aria-hidden="true">info</mat-icon>
                {{
                  'netWorth.detail.nothingSince'
                    | transloco: { date: lastEntryDate() }
                }}
              </p>
            }
            <ol
              class="m-0 overflow-hidden rounded-2xl bg-surface-container-low p-0"
              data-testid="asset-history-list"
            >
              @for (row of rows(); track row.key) {
                <li
                  class="row"
                  [class.recorded]="row.isRecorded"
                  [class.superseded]="row.supersededDate !== null"
                  data-testid="asset-history-entry"
                >
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span
                      class="ph-no-capture truncate text-body-large"
                      [class.font-semibold]="row.isRecorded"
                      data-testid="asset-history-label"
                      >{{ row.label }}</span
                    >
                    <span
                      class="text-body-small text-on-surface-variant"
                      data-testid="asset-history-date"
                      >{{ row.date }}</span
                    >
                    @if (row.supersededDate; as date) {
                      <span
                        class="text-body-small text-on-surface-variant"
                        data-testid="asset-history-superseded"
                        >{{
                          'netWorth.detail.superseded' | transloco: { date }
                        }}</span
                      >
                    }
                  </span>
                  <span
                    class="ph-no-capture whitespace-nowrap text-title-small font-semibold tabular-nums"
                    data-testid="asset-history-amount"
                    >{{ row.amount }}</span
                  >
                </li>
              }
            </ol>

            @if (history.isLoadingMore()) {
              <mat-progress-spinner
                class="self-center"
                mode="indeterminate"
                diameter="28"
                [attr.aria-label]="'common.loading' | transloco"
                data-testid="asset-history-loading-more"
              />
            } @else if (history.loadMoreFailed()) {
              <div
                class="flex flex-wrap items-center justify-center gap-2 text-body-medium text-on-surface-variant"
                role="alert"
                data-testid="asset-history-load-more-error"
              >
                {{ 'netWorth.detail.loadMoreError' | transloco }}
                <button matButton (click)="history.loadMore()">
                  {{ 'common.retry' | transloco }}
                </button>
              </div>
            } @else if (history.hasMore()) {
              <!-- Re-created after each page: a fresh observer fires even if it never left the screen. -->
              <div #sentinel class="h-px" aria-hidden="true"></div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1.25rem;
      list-style: none;
    }
    .row + .row {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .recorded {
      background: var(--mat-sys-surface-container);
    }
    .superseded {
      color: var(--mat-sys-on-surface-variant);
    }
    .superseded [data-testid='asset-history-amount'] {
      font-weight: 400;
    }
    .amber {
      color: var(--pulpe-amber);
    }
  `,
})
export default class AssetDetailPage {
  protected readonly history = inject(AssetHistoryStore);
  protected readonly netWorth = inject(NetWorthStore);
  readonly #dialogs = inject(NetWorthDialogService);
  readonly #router = inject(Router);
  readonly #transloco = inject(TranslocoService);
  readonly #currencyPipe = inject(AppCurrencyPipe);
  readonly #locale = inject(LOCALE_ID);
  readonly #attempt = injectWriteAttempt();

  readonly id = input.required<string>();
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  protected readonly asset = this.history.asset;

  protected readonly viewState = computed<DetailViewState>(() => {
    if (this.history.isNotFound()) return 'notFound';
    if (this.asset()) return 'ready';
    return this.history.firstPage.status() === 'error' ? 'error' : 'loading';
  });

  protected readonly categoryName = computed(() => {
    const categoryId = this.asset()?.categoryId;
    return (
      this.netWorth.categories().find(({ id }) => id === categoryId)?.name ??
      null
    );
  });

  // An overdrawn `own` account reads as a debt, as on « Mon patrimoine ».
  protected readonly isDebt = computed(() => {
    const asset = this.asset();
    return !!asset && (asset.direction === 'owe' || asset.latestValue < 0);
  });

  protected readonly value = computed(() => {
    const asset = this.asset();
    return asset ? this.#signed(asset.latestValue, asset.currency, false) : '';
  });

  protected readonly lastEntryDate = computed(() => {
    const asset = this.asset();
    return asset ? formatEntryDate(asset.latestRecordedAt, this.#locale) : '';
  });

  /** « Ta dernière saisie : 5’000.00 CHF, le 1er novembre », as the edit sheet says it. */
  protected readonly lastEntry = computed(() => {
    const asset = this.asset();
    if (!asset) return '';
    return this.#transloco.translate('netWorth.value.lastValue', {
      amount: this.#signed(asset.recordedValue, asset.currency, false),
      date: this.lastEntryDate(),
    });
  });

  /** Newest first, so an entry on top means nothing was checked since it. */
  protected readonly isNothingSince = computed(
    () => this.history.entries()[0]?.type === 'snapshot',
  );

  protected readonly rows = computed(() => {
    const asset = this.asset();
    if (!asset) return [];
    const recorded = this.#transloco.translate('netWorth.detail.recorded');
    return this.history.entries().map((entry) => {
      const date = formatEntryDate(entry.at, this.#locale);
      // A prévision can come back in another period with the same id.
      const key = `${entry.type}:${entry.id}:${entry.at}`;
      if (entry.type === 'snapshot') {
        return {
          key,
          label: recorded,
          isRecorded: true,
          date,
          amount: this.#signed(entry.value, asset.currency, false),
          supersededDate: null,
        };
      }
      return {
        key,
        label: entry.name,
        isRecorded: false,
        date,
        // No rate for a foreign currency: the server could not convert it.
        amount:
          entry.effect === null
            ? '—'
            : this.#signed(entry.effect, asset.currency, true),
        supersededDate: entry.supersededAt
          ? formatEntryDate(entry.supersededAt, this.#locale)
          : null,
      };
    });
  });

  constructor() {
    // Route id → store selection is an imperative sync, not derived state.
    toObservable(this.id)
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.history.setAssetId(id));

    // Loads the next page as the end of the list scrolls into view.
    effect((onCleanup) => {
      const sentinel = this.sentinel()?.nativeElement;
      if (!sentinel) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) void this.history.loadMore();
        },
        { rootMargin: '200px' },
      );
      observer.observe(sentinel);
      onCleanup(() => observer.disconnect());
    });
  }

  protected goBack(): void {
    void this.#router.navigate(['/', ROUTES.NET_WORTH]);
  }

  protected async onEdit(): Promise<void> {
    const asset = this.asset();
    if (!asset) return;
    const request = await this.#dialogs.openEdit(
      asset,
      this.netWorth.categories(),
      this.netWorth.assets(),
    );
    if (request) {
      await this.#attempt(() => this.netWorth.saveAsset(asset.id, request));
    }
  }

  /** The real minus sign, as on the rows of « Mon patrimoine ». */
  #signed(
    value: number,
    currency: SupportedCurrency,
    withPlus: boolean,
  ): string {
    const sign = value < 0 ? '−' : withPlus && value > 0 ? '+' : '';
    return `${sign}${this.#currencyPipe.transform(Math.abs(value), currency, '1.2-2')}`;
  }
}
