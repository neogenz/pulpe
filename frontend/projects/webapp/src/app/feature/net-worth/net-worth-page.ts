import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  LOCALE_ID,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { AssetCategory } from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { LoadingIndicator } from '@core/loading/loading-indicator';
import { TitleDisplay } from '@core/routing';
import { STORAGE_KEYS, StorageService } from '@core/storage';
import { UserSettingsStore } from '@core/user-settings';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { type AssetRowEvent } from './components/net-worth-asset-row';
import { debtGroups, ownGroups } from './components/net-worth-groups';
import {
  RenameTypeDialog,
  type RenameTypeDialogData,
} from './components/rename-type-dialog';
import { NetWorthFxNotes } from './components/net-worth-fx-notes';
import { type IntroSource } from './components/net-worth-intro.model';
import { NetWorthSankey } from './components/net-worth-sankey';
import { NetWorthSection } from './components/net-worth-section';
import { NetWorthDialogService } from './services/net-worth-dialog.service';
import { NetWorthStore } from './services/net-worth-store';
import { injectWriteAttempt } from './services/write-attempt';

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
        @if (isSettled()) {
          <div class="ml-auto flex shrink-0 items-center gap-2">
            <button
              matIconButton
              (click)="openIntro('help')"
              [attr.aria-label]="'netWorth.intro.help' | transloco"
              data-testid="net-worth-help-button"
            >
              <mat-icon>help_outline</mat-icon>
            </button>
            <!-- The empty state carries its own action: one way in, not two. -->
            @if (!store.isEmpty()) {
              <button
                matButton="filled"
                (click)="onAdd()"
                data-testid="net-worth-add-button"
              >
                <mat-icon>add_circle</mat-icon>
                {{ 'netWorth.addButton' | transloco }}
              </button>
            }
          </div>
        }
      </header>

      @switch (loadState()) {
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
                  class="ph-no-capture m-0 mt-2 text-display-medium font-extrabold tabular-nums sm:text-display-large"
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

            @if (ownGroups().length > 0) {
              <section
                class="flex min-w-0 flex-col gap-3"
                aria-labelledby="net-worth-own-title"
                data-testid="net-worth-own"
              >
                <h2
                  id="net-worth-own-title"
                  class="text-title-large font-semibold"
                >
                  {{ 'netWorth.gross' | transloco }}
                </h2>
                @for (group of ownGroups(); track group.category.id) {
                  <pulpe-net-worth-section
                    [title]="group.category.name"
                    [total]="group.total"
                    [ownedShare]="
                      ownGroups().length > 1 && totals.gross > 0
                        ? group.total / totals.gross
                        : null
                    "
                    [assets]="group.assets"
                    [baseCurrency]="totals.baseCurrency"
                    [busy]="store.isSaving()"
                    [defaultAccountId]="defaultAccountId()"
                    [renamable]="true"
                    [collapsed]="collapsedTypeIds().has(group.category.id)"
                    (toggleCollapsed)="toggleType(group.category.id)"
                    (action)="onAction($event)"
                    (rename)="onRenameType(group.category)"
                  />
                }
              </section>
            }

            @if (debtGroups().length > 0) {
              <section
                class="flex min-w-0 flex-col gap-3"
                aria-labelledby="net-worth-owe-title"
                data-testid="net-worth-owe"
              >
                <h2
                  id="net-worth-owe-title"
                  class="text-title-large font-semibold"
                >
                  {{ 'netWorth.debts' | transloco }}
                </h2>
                @for (group of debtGroups(); track group.category?.id) {
                  @if (group.category; as category) {
                    <pulpe-net-worth-section
                      [title]="category.name"
                      [total]="group.total"
                      [assets]="group.assets"
                      [baseCurrency]="totals.baseCurrency"
                      [busy]="store.isSaving()"
                      [defaultAccountId]="defaultAccountId()"
                      [isDebts]="true"
                      [renamable]="true"
                      [collapsed]="collapsedTypeIds().has(category.id)"
                      (toggleCollapsed)="toggleType(category.id)"
                      (action)="onAction($event)"
                      (rename)="onRenameType(category)"
                    />
                  } @else {
                    <pulpe-net-worth-section
                      [title]="'netWorth.sankey.overdrafts' | transloco"
                      [total]="group.total"
                      [assets]="group.assets"
                      [baseCurrency]="totals.baseCurrency"
                      [busy]="store.isSaving()"
                      [defaultAccountId]="defaultAccountId()"
                      [isDebts]="true"
                      [showCategory]="true"
                      [categoryNames]="categoryNames()"
                      [collapsed]="collapsedTypeIds().has(OVERDRAFTS_KEY)"
                      (toggleCollapsed)="toggleType(OVERDRAFTS_KEY)"
                      (action)="onAction($event)"
                    />
                  }
                }
              </section>
            }

            @if (store.archivedAssets().length > 0) {
              <div class="flex min-w-0 flex-col gap-3">
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
                    [defaultAccountId]="defaultAccountId()"
                    [showCategory]="true"
                    [categoryNames]="categoryNames()"
                    (action)="onAction($event)"
                  />
                }
              </div>
            }
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
  readonly #matDialog = inject(MatDialog);
  readonly #settings = inject(UserSettingsStore);
  protected readonly defaultAccountId = this.#settings.defaultAccountId;
  readonly #attempt = injectWriteAttempt();
  readonly #listFormat = new Intl.ListFormat(inject(LOCALE_ID), {
    style: 'long',
    type: 'conjunction',
  });

  protected readonly today = new Date();
  protected readonly isArchivedShown = signal(false);

  protected readonly OVERDRAFTS_KEY = 'overdrafts';
  readonly #storage = inject(StorageService);
  readonly #loadingIndicator = inject(LoadingIndicator);
  // Per device: a folded Type stays folded on the next visit.
  protected readonly collapsedTypeIds = signal<ReadonlySet<string>>(
    new Set(
      this.#storage.get<string[]>(STORAGE_KEYS.NET_WORTH_COLLAPSED_TYPES) ?? [],
    ),
  );

  protected toggleType(key: string): void {
    const next = new Set(this.collapsedTypeIds());
    if (!next.delete(key)) next.add(key);
    this.collapsedTypeIds.set(next);
    this.#storage.set(STORAGE_KEYS.NET_WORTH_COLLAPSED_TYPES, [...next]);
  }

  /** A refetch after a write keeps the figures on screen: only a cold cache shows the spinner. */
  protected readonly loadState = computed(() => {
    if (this.store.netWorth.isInitialLoading()) return 'loading';
    return this.store.netWorth.status() === 'error' ? 'error' : 'ready';
  });

  /** The page shows its empty state or its figures: not loading, not failed. */
  protected readonly isSettled = computed(
    () =>
      this.loadState() === 'ready' && this.store.netWorth.value() !== undefined,
  );
  #isIntroOpen = false;

  constructor() {
    // The figures stay on screen while a write refetches them: the app's top bar says so.
    effect(() =>
      this.#loadingIndicator.setLoading(this.store.netWorth.isStale()),
    );
    inject(DestroyRef).onDestroy(() =>
      this.#loadingIndicator.setLoading(false),
    );

    // Opens the explainer by itself the first time the page settles on this device.
    effect(() => {
      if (!this.isSettled()) return;
      untracked(() => {
        if (this.#storage.get<boolean>(STORAGE_KEYS.NET_WORTH_INTRO_SEEN))
          return;
        void this.openIntro('auto');
      });
    });
  }

  protected async openIntro(source: IntroSource): Promise<void> {
    if (this.#isIntroOpen) return;
    this.#isIntroOpen = true;
    try {
      const result = await this.#dialogs.openIntro({
        source,
        isEmpty: this.store.isEmpty(),
      });
      this.#storage.set(STORAGE_KEYS.NET_WORTH_INTRO_SEEN, true);
      if (result === 'add') await this.onAdd();
    } finally {
      this.#isIntroOpen = false;
    }
  }

  protected readonly categoryNames = computed(
    () =>
      new Map(
        this.store.categories().map((category) => [category.id, category.name]),
      ),
  );

  protected readonly ownGroups = computed(() =>
    ownGroups(this.store.categories(), this.store.activeAssets()),
  );
  protected readonly debtGroups = computed(() =>
    debtGroups(this.store.categories(), this.store.activeAssets()),
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

  protected async onRenameType(category: AssetCategory): Promise<void> {
    const dialogRef = this.#matDialog.open(RenameTypeDialog, {
      data: { name: category.name } satisfies RenameTypeDialogData,
      width: '400px',
      maxWidth: '90vw',
    });
    const name = await firstValueFrom(dialogRef.afterClosed());
    if (name) {
      await this.#attempt(() => this.store.renameCategory(category.id, name));
    }
  }

  protected async onAdd(): Promise<void> {
    const request = await this.#dialogs.openCreate(
      this.store.categories(),
      this.store.assets(),
    );
    if (request) await this.#attempt(() => this.store.addAsset(request));
  }

  protected async onAction({ asset, action }: AssetRowEvent): Promise<void> {
    switch (action) {
      case 'edit': {
        const request = await this.#dialogs.openEdit(
          asset,
          this.store.categories(),
          this.store.assets(),
        );
        if (request) {
          await this.#attempt(() => this.store.saveAsset(asset.id, request));
        }
        return;
      }
      case 'archive':
      case 'unarchive':
        await this.#attempt(() =>
          this.store.setArchived(asset.id, action === 'archive'),
        );
        // The server clears the default account when it goes away (CA35).
        this.#settings.reload();
        return;
      case 'delete':
        if (await this.#dialogs.confirmDelete(asset)) {
          await this.#attempt(() => this.store.deleteAsset(asset.id));
          this.#settings.reload();
        }
        return;
      case 'setDefault':
      case 'unsetDefault':
        await this.#attempt(async () => {
          await this.#settings.setDefaultAccount(
            action === 'setDefault' ? asset.id : null,
          );
        });
        return;
    }
  }
}
