import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  signal,
  viewChild,
  type ElementRef,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { cachedMutation } from 'ngx-ziflux';
import {
  ANALYTICS_EVENTS,
  partlySpentBudgetLines,
  type Asset,
  type AssetCategory,
  type BudgetLine,
  type SupportedCurrency,
  type Transaction,
} from 'pulpe-shared';
import { filter, firstValueFrom, merge } from 'rxjs';

import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { StorageService } from '@core/storage';
import { UserSettingsStore } from '@core/user-settings';
import { LoadingButton } from '@ui/loading-button';
import type { GuideSource } from './reconcile-guide.model';
import { ReconcileGuide } from './reconcile-guide';
import {
  isEmptyPlan,
  planAccountLinks,
  type AccountLinkPlan,
} from './reconcile-account-links';
import {
  ReconcileAccountsStep,
  summarizeRows,
  type AccountRow,
} from './reconcile-accounts-step';
import {
  AMOUNT_SLOT,
  buildComparison,
  money,
  ReconcileCompareStep,
  type SuggestionRow,
} from './reconcile-compare-step';
import { readFreeAccounts, saveFreeAccounts } from './reconcile-free-accounts';
import {
  ReconcileReasonsSheet,
  type ReasonsSheetChoice,
  type ReasonsSheetData,
} from './reconcile-reasons-sheet';
import { ReconcileSheet } from './reconcile-sheet';

/** The viewed month, as the page already computes it. */
export interface RealizedPosition {
  /** The checked balance, rollover included. */
  readonly balance: number;
  /** « Disponible à dépenser ». */
  readonly available: number;
}

export interface ReconciliationAdjustment {
  readonly name: string;
  readonly kind: 'income' | 'expense';
  readonly amount: number;
}

/** The month's prévisions and movements, as the page holds them. */
export interface ReconcileLedger {
  readonly budgetLines: BudgetLine[];
  readonly transactions: Transaction[];
}

/** A movement or a prévision of the month the dialog opened on. */
export type CheckTarget = Pick<SuggestionRow, 'source' | 'id'>;

/** What the reconciliation reads from « Mon patrimoine ». */
export interface ReconcileNetWorth {
  /** My active items, own and owe, in the budget's currency, followed or not. */
  readonly items: readonly Asset[];
  readonly categories: readonly AssetCategory[];
}

export interface ReconcileAccountsDialogData {
  /**
   * Read live, so a refresh landing mid-flow moves the comparison with it.
   * `null` once the page no longer holds the month the dialog opened on.
   */
  readonly realized: Signal<RealizedPosition | null>;
  /** Read live like `realized`: a checked item leaves the suggestions. */
  readonly ledger: Signal<ReconcileLedger | null>;
  /** Settles once the check is in or refused; on refusal the page says why. */
  readonly checkItem: (target: CheckTarget) => Promise<void>;
  readonly currency: Signal<SupportedCurrency>;
  /** `true` once the entry is written; on refusal the page says why. */
  readonly recordAdjustment: (
    adjustment: ReconciliationAdjustment,
  ) => Promise<boolean>;
  readonly viewItemsToCheck: () => void;
  /**
   * Resolved before the dialog opens: its rows are built once from the
   * followed accounts, never re-read. `null` when the feature is off.
   */
  readonly netWorth: ReconcileNetWorth | null;
  /** First open on this device: the guide comes before step 1. */
  readonly showGuide: boolean;
}

const FREE_ROW = { kind: 'free' } as const;

type Step = 1 | 2;

@Component({
  selector: 'pulpe-reconcile-accounts-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    LoadingButton,
    ReconcileAccountsStep,
    ReconcileCompareStep,
    ReconcileGuide,
  ],
  templateUrl: './reconcile-accounts-dialog.html',
  styleUrl: './reconcile-accounts-dialog.scss',
  host: {
    class: 'pulpe-reconcile-dialog',
    '[class.guide-open]': 'guideSource() !== null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReconcileAccountsDialog {
  readonly #dialogRef = inject(MatDialogRef<ReconcileAccountsDialog>);
  readonly #postHog = inject(PostHogService);
  readonly #assetApi = inject(AssetApi);
  readonly #storage = inject(StorageService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #userSettings = inject(UserSettingsStore);
  readonly #sheet = inject(ReconcileSheet);
  readonly #injector = inject(Injector);
  readonly #destroyRef = inject(DestroyRef);
  protected readonly data =
    inject<ReconcileAccountsDialogData>(MAT_DIALOG_DATA);

  private readonly scrollContent =
    viewChild<ElementRef<HTMLElement>>('scrollContent');
  private readonly accountsStep = viewChild(ReconcileAccountsStep);

  protected readonly step = signal<Step>(1);
  // The guide is a view of this dialog, not another one: the steps below keep
  // their rows and amounts while it shows, and « ? » can replay it from any step.
  protected readonly guideSource = signal<GuideSource | null>(
    this.data.showGuide ? 'auto' : null,
  );
  readonly #items = this.data.netWorth?.items ?? [];
  readonly #followed = this.#items.filter((asset) => asset.inPulpe);
  // Mon patrimoine's followed items, then the free names remembered on this
  // device (amounts empty), else one blank row to type in.
  protected readonly accounts = signal<AccountRow[]>(
    this.#initialRows().map((row, id) => ({ ...row, id })),
  );
  // Saving targets of this month never offer themselves: a comparison is about spending.
  protected readonly offers = computed(() => {
    const saving = new Set(
      (this.data.ledger()?.budgetLines ?? []).flatMap((line) =>
        line.kind === 'saving' && line.assetId ? [line.assetId] : [],
      ),
    );
    return this.#items.filter((asset) => !saving.has(asset.id));
  });
  readonly #writeLinks = cachedMutation<AccountLinkPlan, true>({
    cache: this.#assetApi.cache,
    invalidateKeys: () => [['assets']],
    mutationFn: async (plan) => {
      for (const [ids, inPulpe] of [
        [plan.links, true],
        [plan.unlinks, false],
      ] as const) {
        for (const id of ids) {
          await firstValueFrom(this.#assetApi.update$(id, { inPulpe }));
        }
      }
      if (plan.snapshots.length > 0) {
        await firstValueFrom(
          this.#assetApi.recordSnapshots$({ items: plan.snapshots }),
        );
      }
      return true as const;
    },
    // A write that stopped halfway still changed « Mon patrimoine ».
    onError: () => this.#assetApi.cache.invalidate(['assets']),
  });

  protected readonly summary = computed(() => summarizeRows(this.accounts()));

  // Taken at this comparison's first check: « trouvés » measures from
  // `compared`, and `realized` is struck once a check moves it. A figure that
  // moves without a check drops `compared` only: the next check restarts it.
  readonly #beforeChecks = signal<{
    readonly compared: number | null;
    readonly realized: number;
  } | null>(null);
  readonly #isDismissed = signal(false);

  protected readonly comparison = computed(() => {
    const totalCents = this.summary().totalCents;
    const realized = this.data.realized();
    const ledger = this.data.ledger();
    if (totalCents === null || !realized || !ledger) return null;
    return buildComparison({
      onAccountsCents: totalCents,
      realizedBalance: realized.balance,
      available: realized.available,
      budgetLines: ledger.budgetLines,
      transactions: ledger.transactions,
      comparedBefore: this.#beforeChecks()?.compared ?? null,
      realizedBefore: this.#beforeChecks()?.realized ?? null,
      isDismissed: this.#isDismissed(),
      payDayOfMonth: this.#userSettings.payDayOfMonth(),
      today: new Date(),
    });
  });

  // Offered even when the card is the only account: removing it then goes back to step 1.
  protected readonly oweTotal = computed(() => {
    const { hasOwe, oweCents } = this.summary();
    return hasOwe && (this.comparison()?.gap ?? 0) < 0 ? oweCents / 100 : null;
  });

  // One check at a time: the gap and the suggestions move with each one.
  protected readonly checkingId = signal<string | null>(null);
  // The write is out: every exit waits for it, so nothing the user typed can
  // disappear behind a write that lands anyway.
  protected readonly isRecording = signal(false);
  protected readonly isBusy = computed(
    () => this.isRecording() || this.checkingId() !== null,
  );
  #isBalancesSaved = false;
  // A comparison was completed in this dialog: its balances reach « Mon patrimoine »
  // once, when the dialog ends, with the rows as they are then.
  #isDone = false;
  readonly #isHeadingToFocus = signal(false);

  constructor() {
    // The browser's back closes the dialog without close(): the balances still go.
    this.#destroyRef.onDestroy(() => this.#saveBalancesOnce());
    merge(
      this.#dialogRef.backdropClick(),
      this.#dialogRef
        .keydownEvents()
        // A held key repeats: only the first press leaves the replayed guide.
        .pipe(filter((event) => event.key === 'Escape' && !event.repeat)),
    )
      .pipe(takeUntilDestroyed())
      // Replayed from « ? »: leaving is going back to the step, not abandoning the comparison.
      .subscribe(() =>
        this.guideSource() === 'help' ? this.leaveGuide() : this.close(),
      );

    // The page no longer holds the month this dialog opened on: nothing is left
    // to hold the accounts against, so it closes — once a write already out
    // has settled, on the month it was aimed at.
    effect(() => {
      if (this.data.realized() === null && !this.#isDone) this.close();
    });

    // The content is swapped under a button that stays put, so without this a
    // screen reader hears nothing change. The step's heading takes the focus
    // once it shows.
    afterRenderEffect(() => {
      if (!this.#isHeadingToFocus()) return;
      const content = this.scrollContent()?.nativeElement;
      const heading = content?.querySelector<HTMLElement>('.step-heading');
      if (!content || !heading) return;
      this.#isHeadingToFocus.set(false);
      content.scrollTo?.({ top: 0 });
      heading.focus({ preventScroll: true });
    });
  }

  protected readonly canContinue = computed(() => this.summary().canContinue);

  protected readonly AMOUNT_SLOT = AMOUNT_SLOT;

  protected money(value: number): string {
    return money(value, this.data.currency());
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected openGuide(): void {
    this.guideSource.set('help');
  }

  protected leaveGuide(): void {
    this.guideSource.set(null);
    this.#goTo(this.step());
  }

  // Each « Comparer » starts a comparison of its own.
  protected next(): void {
    if (!this.canContinue() || this.step() === 2) return;
    saveFreeAccounts(
      this.#storage,
      this.accounts().flatMap((row) =>
        row.account.kind === 'free'
          ? [{ name: row.label, side: row.side }]
          : [],
      ),
    );
    this.#beforeChecks.set(null);
    this.#isDismissed.set(false);
    this.#goTo(2);
  }

  #initialRows(): Omit<AccountRow, 'id'>[] {
    const rows: Omit<AccountRow, 'id'>[] = [
      ...this.#followed.map((asset) => ({
        label: asset.name,
        amountText: '',
        side: asset.direction,
        account: { kind: 'asset' as const, id: asset.id },
      })),
      ...readFreeAccounts(this.#storage).map(({ name, side }) => ({
        label: name,
        amountText: '',
        side,
        account: FREE_ROW,
      })),
    ];
    return rows.length > 0
      ? rows
      : [{ label: '', amountText: '', side: 'own', account: FREE_ROW }];
  }

  protected back(): void {
    if (this.isRecording()) return;
    this.#goTo(1);
  }

  #goTo(step: Step): void {
    this.step.set(step);
    this.#isHeadingToFocus.set(true);
  }

  // One write per comparison. A refusal leaves the screen as it was (the page
  // has already said why), so retrying is one press.
  protected async record(): Promise<void> {
    const view = this.comparison();
    if (!view || view.gap === 0 || this.isBusy() || this.#isDone) return;
    const kind = view.gap > 0 ? 'income' : 'expense';
    this.isRecording.set(true);
    try {
      const isRecorded = await this.data.recordAdjustment({
        name: this.#transloco.translate(
          'currentMonth.reconcile.compare.entryName',
        ),
        kind,
        amount: Math.abs(view.gap),
      });
      if (isRecorded) this.#complete(kind);
    } finally {
      this.isRecording.set(false);
    }
  }

  protected async check(row: SuggestionRow): Promise<void> {
    const view = this.comparison();
    if (!view || this.isBusy()) return;
    this.checkingId.set(row.id);
    this.#beforeChecks.update((before) => ({
      compared: before?.compared ?? view.compared,
      realized: before?.realized ?? view.realized,
    }));
    try {
      await this.data.checkItem(row);
    } finally {
      this.checkingId.set(null);
    }
  }

  // Both leave with the button that had the focus: the heading takes it.
  protected dismiss(): void {
    this.#isDismissed.set(true);
    this.#isHeadingToFocus.set(true);
  }

  #forgetFound(): void {
    this.#beforeChecks.update(
      (before) => before && { compared: null, realized: before.realized },
    );
  }

  protected removeOwe(): void {
    this.accounts.update((rows) => rows.filter((row) => row.side !== 'owe'));
    // The accounts total moved: what was found no longer measures against it.
    this.#forgetFound();
    // Nothing typed is left to compare: back to the balances, as on iOS.
    if (this.summary().totalCents === null) this.#goTo(1);
    else this.#isHeadingToFocus.set(true);
  }

  // [Terminer], « Laisser comme ça » and « Non, laisser comme ça ».
  protected leave(): void {
    if (this.comparison() && !this.isBusy()) this.#complete('none');
  }

  // « Voir les autres raisons »: the sheet only answers, the step does what
  // that answer does here.
  protected async showReasons(): Promise<void> {
    const view = this.comparison();
    const ledger = this.data.ledger();
    if (!view || !ledger || this.isBusy()) return;
    const [partly] = partlySpentBudgetLines(
      ledger.budgetLines,
      ledger.transactions,
    );
    const line = ledger.budgetLines.find(({ id }) => id === partly?.id);
    const choice = await this.#sheet.open<
      ReconcileReasonsSheet,
      ReasonsSheetData,
      ReasonsSheetChoice
    >(
      ReconcileReasonsSheet,
      {
        gap: view.gap,
        currency: this.data.currency(),
        hasOwe: this.summary().hasOwe,
        partlySpent:
          partly && line
            ? { ...partly, name: line.name, amount: line.amount }
            : null,
        note: view.note,
      },
      // An amount never goes into an attribute: the title keeps it, masked.
      this.#transloco.translate('currentMonth.reconcile.reasons.label'),
      this.#destroyRef,
    );
    switch (choice) {
      case 'addOwe':
        return this.addOwe();
      case 'reviewAccounts':
        return this.back();
      case 'leave':
        return this.leave();
      case 'noteIncome':
        // Kept by the heading while the entry is written, and after a refusal.
        this.#isHeadingToFocus.set(true);
        // The figures moved while the sheet was open: the amount it offered is
        // no longer the gap, or an item now explains it, so the person sees
        // the new comparison instead.
        if (
          this.comparison()?.gap !== view.gap ||
          this.comparison()?.screen !== view.screen
        ) {
          return;
        }
        return this.record();
      default:
        this.#isHeadingToFocus.set(true);
    }
  }

  // [Ajouter ce que je dois]: back to the balances, where step 1 adds the row and focuses its name.
  protected addOwe(): void {
    // A second press before step 1 renders would add a second row.
    if (this.step() !== 2 || this.isBusy()) return;
    this.step.set(1);
    afterNextRender(
      () => this.accountsStep()?.addRow({ kind: 'free', side: 'owe' }),
      { injector: this.#injector },
    );
  }

  // Once per dialog: the event, then the dialog ends with the balances saved.
  #complete(kind: 'income' | 'expense' | 'none'): void {
    if (this.#isDone) return;
    this.#isDone = true;
    this.#postHog.captureEvent(
      ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED,
      { adjustment_kind: kind },
    );
    this.#saveBalancesOnce();
    this.#dialogRef.close();
  }

  // One save per dialog: two would race, and the second plan would read links
  // the first one already changed.
  #saveBalancesOnce(): void {
    if (!this.#isDone || this.#isBalancesSaved) return;
    this.#isBalancesSaved = true;
    void this.#saveBalances();
  }

  // The reconciliation is done by the time this runs, so a failure changes
  // nothing about how the dialog ends: the rows are read before the first
  // await, and only a toast says the balances did not reach « Mon patrimoine ».
  async #saveBalances(): Promise<void> {
    if (this.data.netWorth === null) return;
    const plan = planAccountLinks(
      this.accounts(),
      this.#followed.map((asset) => asset.id),
    );
    if (isEmptyPlan(plan) || (await this.#writeLinks.mutate(plan))) return;
    this.#snackBar.open(
      this.#transloco.translate('currentMonth.reconcile.balancesNotSaved'),
      this.#transloco.translate('common.close'),
      { duration: 5000 },
    );
  }

  protected viewItemsToCheck(): void {
    this.close();
    this.data.viewItemsToCheck();
  }

  protected close(): void {
    if (this.isRecording()) return;
    this.#saveBalancesOnce();
    this.#dialogRef.close();
  }
}
