import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { isApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { AppCurrencyPipe } from '@core/currency';
import { TitleDisplay } from '@core/routing';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { type AssetRowEvent } from './components/net-worth-asset-row';
import { NetWorthFxNotes } from './components/net-worth-fx-notes';
import { NetWorthSankey } from './components/net-worth-sankey';
import { NetWorthSection } from './components/net-worth-section';
import { NetWorthDialogService } from './services/net-worth-dialog.service';
import { NetWorthStore } from './services/net-worth-store';

@Component({
  selector: 'pulpe-net-worth-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
    BaseLoading,
    StateCard,
    NetWorthFxNotes,
    NetWorthSankey,
    NetWorthSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex h-full min-w-0 flex-col gap-6"
      data-testid="net-worth-page"
    >
      <header class="pulpe-page-header" data-testid="page-header">
        <div class="min-w-0">
          <h1
            class="min-w-0 flex-shrink truncate text-headline-medium font-bold md:text-display-small"
            data-testid="page-title"
          >
            {{ title.currentTitle() }}
          </h1>
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <button
            matButton="outlined"
            (click)="onOpenCategories()"
            data-testid="net-worth-categories-button"
          >
            <mat-icon>category</mat-icon>
            {{ 'netWorth.categoriesButton' | transloco }}
          </button>
          <button
            matButton="filled"
            (click)="onAdd()"
            data-testid="net-worth-add-button"
          >
            <mat-icon>add_circle</mat-icon>
            {{ 'netWorth.addButton' | transloco }}
          </button>
        </div>
      </header>

      @switch (store.netWorth.status()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'common.loading' | transloco"
            size="large"
            testId="net-worth-loading"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'common.error' | transloco"
            [message]="'netWorth.loadError' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="store.refresh()"
            testId="net-worth-error"
          />
        }
        @default {
          @if (store.isEmpty()) {
            <pulpe-state-card
              variant="empty"
              [title]="'netWorth.emptyTitle' | transloco"
              [message]="'netWorth.emptyMessage' | transloco"
              [actionLabel]="'netWorth.emptyAction' | transloco"
              (action)="onAdd()"
              testId="net-worth-empty"
            />
          } @else if (store.totals(); as totals) {
            <section
              class="flex flex-col items-center gap-5"
              [attr.aria-label]="'netWorth.heroTitle' | transloco"
            >
              <div
                class="hero w-full rounded-[32px] px-6 py-10 text-center"
                [class.hero-warning]="totals.net < 0"
                data-testid="net-worth-hero"
              >
                <p class="m-0 text-title-medium">
                  {{ 'netWorth.heroTitle' | transloco }}
                </p>
                <p
                  class="ph-no-capture m-0 mt-2 text-display-large font-extrabold tabular-nums"
                  [class.amber]="totals.net < 0"
                  data-testid="net-worth-net"
                >
                  {{ totals.net | appCurrency: totals.baseCurrency : '1.0-0' }}
                </p>
                <p class="m-0 mt-3 text-body-medium">
                  @if (totals.net < 0) {
                    {{ 'netWorth.negativeNote' | transloco }}
                  } @else {
                    {{
                      'netWorth.heroSubtitle'
                        | transloco: { date: today | date: 'longDate' }
                    }}
                  }
                </p>
              </div>

              <div class="flex flex-wrap justify-center gap-3">
                <div class="pill pill-gross" data-testid="net-worth-gross">
                  <mat-icon aria-hidden="true">account_balance</mat-icon>
                  <span class="flex flex-col">
                    <span class="text-label-medium">{{
                      'netWorth.gross' | transloco
                    }}</span>
                    <span
                      class="ph-no-capture text-title-medium font-bold tabular-nums"
                      >{{
                        totals.gross
                          | appCurrency: totals.baseCurrency : '1.0-0'
                      }}</span
                    >
                  </span>
                </div>
                <div class="pill pill-debts" data-testid="net-worth-debts">
                  <mat-icon class="amber" aria-hidden="true"
                    >credit_card</mat-icon
                  >
                  <span class="flex flex-col">
                    <span class="text-label-medium">{{
                      'netWorth.debts' | transloco
                    }}</span>
                    <span
                      class="ph-no-capture amber text-title-medium font-bold tabular-nums"
                      >{{
                        totals.debts
                          | appCurrency: totals.baseCurrency : '1.0-0'
                      }}</span
                    >
                  </span>
                </div>
              </div>

              <pulpe-net-worth-fx-notes
                [assets]="store.activeAssets()"
                [baseCurrency]="totals.baseCurrency"
              />

              @if (totals.incomplete) {
                <p
                  role="status"
                  class="ph-no-capture m-0 flex w-full items-start gap-3 rounded-2xl bg-tertiary-container p-4 text-body-medium text-on-tertiary-container"
                  data-testid="net-worth-incomplete"
                >
                  <mat-icon aria-hidden="true">info</mat-icon>
                  {{
                    'netWorth.incompleteNotice'
                      | transloco
                        : {
                            currency: unconvertedCurrencies(),
                            assets: unconvertedNames(),
                          }
                  }}
                </p>
              }
            </section>

            @if (store.netWorth.value(); as netWorth) {
              <pulpe-net-worth-sankey [netWorth]="netWorth" />
            }

            <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
              <div class="flex min-w-0 flex-col gap-4 lg:col-span-2">
                @for (section of categorySections(); track section.id) {
                  <pulpe-net-worth-section
                    [title]="section.name"
                    [total]="section.total"
                    [assets]="section.assets"
                    [baseCurrency]="totals.baseCurrency"
                    [busy]="store.isSaving()"
                    (action)="onAction($event)"
                  />
                }
              </div>

              <div class="flex min-w-0 flex-col gap-3">
                @if (debtAssets().length > 0) {
                  <pulpe-net-worth-section
                    [title]="'netWorth.debts' | transloco"
                    [total]="totals.debts"
                    [assets]="debtAssets()"
                    [baseCurrency]="totals.baseCurrency"
                    [busy]="store.isSaving()"
                    [isDebts]="true"
                    [showCategory]="true"
                    [categoryNames]="categoryNames()"
                    (action)="onAction($event)"
                  />
                }
                @if (store.archivedAssets().length > 0) {
                  <button
                    matButton
                    class="self-start"
                    [attr.aria-expanded]="isArchivedShown()"
                    (click)="isArchivedShown.set(!isArchivedShown())"
                    data-testid="net-worth-archived-toggle"
                  >
                    <mat-icon>{{
                      isArchivedShown() ? 'expand_less' : 'expand_more'
                    }}</mat-icon>
                    {{
                      isArchivedShown()
                        ? ('netWorth.hideArchived' | transloco)
                        : ('netWorth.showArchived'
                          | transloco: { count: store.archivedAssets().length })
                    }}
                  </button>
                  @if (isArchivedShown()) {
                    <pulpe-net-worth-section
                      [title]="'netWorth.archivedTitle' | transloco"
                      [assets]="store.archivedAssets()"
                      [baseCurrency]="totals.baseCurrency"
                      [busy]="store.isSaving()"
                      [showCategory]="true"
                      [categoryNames]="categoryNames()"
                      (action)="onAction($event)"
                    />
                  }
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      position: relative;
    }
    .hero {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .hero-warning {
      background: color-mix(
        in srgb,
        var(--pulpe-amber-container) 55%,
        var(--mat-sys-surface)
      );
      color: var(--mat-sys-on-surface-variant);
    }
    .pill {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      border-radius: 9999px;
      padding: 0.625rem 1.125rem;
    }
    .pill-gross {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .pill-debts {
      background: var(--pulpe-amber-container);
      color: var(--mat-sys-on-surface);
    }
    .amber {
      color: var(--pulpe-amber);
    }
  `,
})
export default class NetWorthPage {
  protected readonly store = inject(NetWorthStore);
  protected readonly title = inject(TitleDisplay);
  readonly #dialogs = inject(NetWorthDialogService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #errorLocalizer = inject(ApiErrorLocalizer);
  readonly #listFormat = new Intl.ListFormat(inject(LOCALE_ID), {
    style: 'long',
    type: 'conjunction',
  });

  protected readonly today = new Date();
  protected readonly isArchivedShown = signal(false);

  protected readonly categoryNames = computed(
    () =>
      new Map(
        this.store.categories().map((category) => [category.id, category.name]),
      ),
  );

  // An overdrawn account sits with the debts, not in its category.
  protected readonly categorySections = computed(() =>
    this.store
      .categories()
      .map((category) => ({
        ...category,
        assets: this.store
          .activeAssets()
          .filter(
            (asset) =>
              asset.categoryId === category.id &&
              asset.direction === 'own' &&
              asset.latestValue >= 0,
          ),
      }))
      .filter((section) => section.assets.length > 0),
  );
  protected readonly debtAssets = computed(() =>
    this.store
      .activeAssets()
      .filter((asset) => asset.direction === 'owe' || asset.latestValue < 0),
  );

  readonly #unconverted = computed(() =>
    this.store.activeAssets().filter((asset) => asset.convertedValue === null),
  );
  protected readonly unconvertedNames = computed(() =>
    this.#listFormat.format(this.#unconverted().map((asset) => asset.name)),
  );
  protected readonly unconvertedCurrencies = computed(() =>
    this.#listFormat.format(
      new Set(this.#unconverted().map((asset) => asset.currency)),
    ),
  );

  protected onOpenCategories(): Promise<void> {
    return this.#dialogs.openCategories();
  }

  protected async onAdd(): Promise<void> {
    const request = await this.#dialogs.openCreate(this.store.categories());
    if (request) await this.#attempt(() => this.store.addAsset(request));
  }

  protected async onAction({ asset, action }: AssetRowEvent): Promise<void> {
    switch (action) {
      case 'updateValue': {
        const value = await this.#dialogs.openValue(asset);
        if (value !== undefined) {
          await this.#attempt(() => this.store.recordValue(asset.id, value));
        }
        return;
      }
      case 'edit': {
        const request = await this.#dialogs.openEdit(
          asset,
          this.store.categories(),
        );
        if (request) {
          await this.#attempt(() => this.store.editAsset(asset.id, request));
        }
        return;
      }
      case 'applySuggestion': {
        const { suggestion } = asset;
        if (suggestion) {
          await this.#attempt(() =>
            this.store.recordValue(asset.id, suggestion.proposedValue),
          );
        }
        return;
      }
      case 'dismissSuggestion':
        await this.#attempt(() => this.store.dismissSuggestion(asset.id));
        return;
      case 'archive':
      case 'unarchive':
        await this.#attempt(() =>
          this.store.setArchived(asset.id, action === 'archive'),
        );
        return;
      case 'delete':
        if (await this.#dialogs.confirmDelete(asset)) {
          await this.#attempt(() => this.store.deleteAsset(asset.id));
        }
        return;
    }
  }

  async #attempt(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch (error) {
      const message = isApiError(error)
        ? this.#errorLocalizer.localizeApiError(error)
        : this.#transloco.translate('common.error');
      this.#snackBar.open(message, this.#transloco.translate('common.close'), {
        duration: 5000,
        panelClass: ['bg-error-container', 'text-on-error-container'],
      });
    }
  }
}
