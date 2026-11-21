import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  LOCALE_ID,
  signal,
  viewChild,
  type ElementRef,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import type { ErrorStateMatcher } from '@angular/material/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { cachedMutation } from 'ngx-ziflux';
import {
  ANALYTICS_EVENTS,
  pointingCandidates,
  reconciliationVerdict,
  type Asset,
  type AssetCategory,
  type BudgetLine,
  type BudgetPeriodDates,
  type SupportedCurrency,
  type Transaction,
} from 'pulpe-shared';
import { filter, firstValueFrom, merge } from 'rxjs';

import { PostHogService } from '@core/analytics/posthog';
import { AssetApi } from '@core/asset/asset-api';
import { AppCurrencyPipe } from '@core/currency';
import { StorageService } from '@core/storage';
import { LoadingButton } from '@ui/loading-button';
import { StepProgress } from '@ui/step-progress';
import type { GuideSource } from './reconcile-guide.model';
import { ReconcileGuide } from './reconcile-guide';
import {
  CENTS_PER_UNIT,
  isEmptyPlan,
  planAccountLinks,
  type AccountLinkPlan,
} from './reconcile-account-links';
import {
  ReconcileAccountsStep,
  summarizeRows,
  type AccountRow,
} from './reconcile-accounts-step';
import { readFreeAccounts, saveFreeAccounts } from './reconcile-free-accounts';

/** The pointed side of the viewed month, as the page already computes it. */
export interface RealizedPosition {
  readonly balance: number;
  readonly checkedIncome: number;
  /** Expenses and savings together, the way the realized balance counts them. */
  readonly checkedOutflows: number;
  readonly rollover: number;
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
  /** Read live like `realized`: a pointed movement leaves the candidates. */
  readonly ledger: Signal<ReconcileLedger | null>;
  /** Settles once the check is in or refused; on refusal the page says why. */
  readonly pointTransaction: (transactionId: string) => Promise<void>;
  readonly currency: Signal<SupportedCurrency>;
  readonly periodDates: Signal<BudgetPeriodDates>;
  /** `true` once the adjustment is written; on refusal the page says why. */
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

type Step = 1 | 2 | 3;

@Component({
  selector: 'pulpe-reconcile-accounts-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe,
    AppCurrencyPipe,
    LoadingButton,
    ReconcileAccountsStep,
    ReconcileGuide,
    StepProgress,
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
  readonly #injector = inject(Injector);
  readonly #postHog = inject(PostHogService);
  readonly #assetApi = inject(AssetApi);
  readonly #storage = inject(StorageService);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #dayMonthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'short',
  });
  protected readonly data =
    inject<ReconcileAccountsDialogData>(MAT_DIALOG_DATA);
  protected readonly centsPerUnit = CENTS_PER_UNIT;

  private readonly stepHeading =
    viewChild<ElementRef<HTMLElement>>('stepHeading');

  private readonly scrollContent =
    viewChild<ElementRef<HTMLElement>>('scrollContent');

  protected readonly steps = [
    { labelKey: 'currentMonth.reconcile.steps.accounts' },
    { labelKey: 'currentMonth.reconcile.steps.realized' },
    { labelKey: 'currentMonth.reconcile.steps.verdict' },
  ] as const;
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

  // Against the live balance: what step 3 shows is what gets recorded.
  protected readonly verdict = computed(() => {
    const totalCents = this.summary().totalCents;
    const realized = this.data.realized();
    return totalCents === null || realized === null
      ? null
      : reconciliationVerdict(totalCents, realized.balance);
  });

  protected readonly adjustment = computed(() => {
    const verdict = this.verdict();
    return verdict === null || verdict.kind === 'upToDate' ? null : verdict;
  });

  // Movements the bank already shows but the balance does not: an adjustment
  // written instead would count them twice once they are pointed.
  protected readonly candidates = computed(() => {
    const adjustment = this.adjustment();
    const ledger = this.data.ledger();
    if (adjustment === null || ledger === null) return [];
    const gap =
      adjustment.kind === 'income' ? adjustment.amount : -adjustment.amount;
    return pointingCandidates(gap, ledger.budgetLines, ledger.transactions).map(
      ({ transaction, remainingGap }) => ({
        transaction,
        remainingGap,
        remainingSign: remainingGap > 0 ? '+' : '−',
        remainingAmount: Math.abs(remainingGap),
        budgetLineName:
          ledger.budgetLines.find(
            (line) => line.id === transaction.budgetLineId,
          )?.name ?? null,
      }),
    );
  });

  // One pointing at a time: the gap and the candidates move with each one.
  protected readonly pointingId = signal<string | null>(null);

  protected readonly adjustmentLabel = signal(
    this.#transloco.translate('currentMonth.reconcile.verdict.defaultLabel'),
  );
  protected readonly blankLabel: ErrorStateMatcher = {
    isErrorState: (control) =>
      !!control?.touched && String(control.value ?? '').trim() === '',
  };

  // The write is out: every exit waits for it, so nothing the user typed can
  // disappear behind a write that lands anyway.
  protected readonly isRecording = signal(false);
  protected readonly canRecord = computed(
    () =>
      this.adjustment() !== null &&
      this.adjustmentLabel().trim() !== '' &&
      !this.isRecording() &&
      this.pointingId() === null,
  );
  // A refresh can bring the balance level while the write is out. That write
  // ends the flow, so Finish waits rather than completing a second time.
  protected readonly canFinish = computed(
    () =>
      this.verdict()?.kind === 'upToDate' &&
      !this.isRecording() &&
      this.pointingId() === null,
  );
  #isCompleted = false;

  constructor() {
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
      if (this.data.realized() === null && !this.#isCompleted) this.close();
    });
  }

  // Same rule as the hero: a period on the calendar month is named by the
  // month alone, and only a payday off the 1st needs its bounds spelled out.
  protected readonly periodRange = computed(() => {
    const { startDate, endDate } = this.data.periodDates();
    if (startDate.getDate() === 1) return null;
    return {
      start: this.#dayMonthFormatter.format(startDate),
      end: this.#dayMonthFormatter.format(endDate),
    };
  });

  protected readonly canContinue = computed(() => this.summary().canContinue);

  // An amount and its currency never part across two lines.
  protected keepTogether(amount: string | null): string {
    return (amount ?? '').replace(/\s/g, '\u00a0');
  }

  protected openGuide(): void {
    this.guideSource.set('help');
  }

  protected leaveGuide(): void {
    this.guideSource.set(null);
    this.#goTo(this.step());
  }

  protected next(): void {
    const step = this.step();
    if (!this.canContinue() || step === 3) return;
    if (step === 1) {
      saveFreeAccounts(
        this.#storage,
        this.accounts().flatMap((row) =>
          row.account.kind === 'free'
            ? [{ name: row.label, side: row.side }]
            : [],
        ),
      );
    }
    this.#goTo((step + 1) as Step);
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
    const step = this.step();
    if (step === 1) {
      this.close();
      return;
    }
    this.#goTo((step - 1) as Step);
  }

  // The content is swapped under a button that stays put, so without this a
  // screen reader hears nothing change. The step's heading takes the focus.
  #goTo(step: Step): void {
    this.step.set(step);
    afterNextRender(
      () => {
        this.scrollContent()?.nativeElement.scrollTo?.({ top: 0 });
        this.stepHeading()?.nativeElement.focus({ preventScroll: true });
      },
      { injector: this.#injector },
    );
  }

  // One write per completed flow. A refusal leaves the step and the label as
  // they were — the page has already said why — so retrying is one press.
  protected async record(): Promise<void> {
    const adjustment = this.adjustment();
    const name = this.adjustmentLabel().trim();
    if (!adjustment || !name || this.isRecording() || this.#isCompleted) return;

    this.isRecording.set(true);
    try {
      const isRecorded = await this.data.recordAdjustment({
        name,
        kind: adjustment.kind,
        amount: adjustment.amount,
      });
      if (!isRecorded) return;
      this.#isCompleted = true;
      this.#postHog.captureEvent(
        ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED,
        { adjustment_kind: adjustment.kind },
      );
      void this.#saveBalances();
      this.#dialogRef.close();
    } finally {
      this.isRecording.set(false);
    }
  }

  protected async point(transactionId: string): Promise<void> {
    if (this.pointingId() !== null || this.isRecording()) return;
    this.pointingId.set(transactionId);
    try {
      await this.data.pointTransaction(transactionId);
    } finally {
      this.pointingId.set(null);
    }
  }

  protected finish(): void {
    if (!this.canFinish() || this.#isCompleted) return;
    this.#isCompleted = true;
    this.#postHog.captureEvent(
      ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED,
      {
        adjustment_kind: 'none',
      },
    );
    void this.#saveBalances();
    this.close();
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
    this.#dialogRef.close();
  }
}
