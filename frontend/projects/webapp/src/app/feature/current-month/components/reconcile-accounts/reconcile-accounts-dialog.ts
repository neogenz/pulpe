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
  viewChildren,
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ANALYTICS_EVENTS,
  CURRENCY_METADATA,
  parseAccountAmount,
  reconciliationVerdict,
  summarizeAccounts,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from 'pulpe-shared';
import { filter, merge } from 'rxjs';

import { PostHogService } from '@core/analytics/posthog';
import { AppCurrencyPipe } from '@core/currency';
import { LoadingButton } from '@ui/loading-button';
import { StepProgress } from '@ui/step-progress';

/** The pointed side of the active month, as the page already computes it. */
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

export interface ReconcileAccountsDialogData {
  /**
   * Read live, so a refresh landing mid-flow moves the comparison with it.
   * `null` once the page no longer holds the month the dialog opened on.
   */
  readonly realized: Signal<RealizedPosition | null>;
  readonly currency: Signal<SupportedCurrency>;
  readonly periodDates: Signal<BudgetPeriodDates>;
  /** `true` once the adjustment is written; on refusal the page says why. */
  readonly recordAdjustment: (
    adjustment: ReconciliationAdjustment,
  ) => Promise<boolean>;
  readonly viewItemsToCheck: () => void;
}

interface AccountRow {
  readonly id: number;
  readonly label: string;
  readonly amountText: string;
}

type Step = 1 | 2 | 3;

const CENTS_PER_UNIT = 100;
const LEADING_MINUS = /^\s*[-−]/;

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
    MatTooltipModule,
    TranslocoPipe,
    AppCurrencyPipe,
    LoadingButton,
    StepProgress,
  ],
  templateUrl: './reconcile-accounts-dialog.html',
  styleUrl: './reconcile-accounts-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReconcileAccountsDialog {
  readonly #dialogRef = inject(MatDialogRef<ReconcileAccountsDialog>);
  readonly #injector = inject(Injector);
  readonly #postHog = inject(PostHogService);
  readonly #dayMonthFormatter = new Intl.DateTimeFormat(inject(LOCALE_ID), {
    day: 'numeric',
    month: 'short',
  });
  protected readonly data =
    inject<ReconcileAccountsDialogData>(MAT_DIALOG_DATA);
  protected readonly centsPerUnit = CENTS_PER_UNIT;

  private readonly labelInputs =
    viewChildren<ElementRef<HTMLInputElement>>('labelInput');
  private readonly amountInputs =
    viewChildren<ElementRef<HTMLInputElement>>('amountInput');
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
  protected readonly accounts = signal<AccountRow[]>([
    { id: 0, label: '', amountText: '' },
  ]);
  #nextAccountId = 1;

  // Flagged once the field is left, never mid-keystroke: "12." is on its way
  // to "12.50". It never counts in the total either way.
  protected readonly unreadableAmount: ErrorStateMatcher = {
    isErrorState: (control) =>
      !!control?.touched &&
      parseAccountAmount(String(control.value ?? '')).status === 'invalid',
  };

  protected readonly summary = computed(() =>
    summarizeAccounts(this.accounts().map((account) => account.amountText)),
  );

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

  protected readonly adjustmentLabel = signal(
    inject(TranslocoService).translate(
      'currentMonth.reconcile.verdict.defaultLabel',
    ),
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
      !this.isRecording(),
  );
  // A refresh can bring the balance level while the write is out. That write
  // ends the flow, so Finish waits rather than completing a second time.
  protected readonly canFinish = computed(
    () => this.verdict()?.kind === 'upToDate' && !this.isRecording(),
  );
  #isCompleted = false;

  constructor() {
    merge(
      this.#dialogRef.backdropClick(),
      this.#dialogRef
        .keydownEvents()
        .pipe(filter((event) => event.key === 'Escape')),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.close());

    // The page no longer holds the month this dialog opened on: nothing is left
    // to hold the accounts against, so it closes — once a write already out
    // has settled, on the month it was aimed at.
    effect(() => {
      if (this.data.realized() === null && !this.#isCompleted) this.close();
    });
  }

  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.data.currency()].symbol,
  );

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

  protected readonly accountViews = computed(() =>
    this.accounts().map((account) => ({
      ...account,
      isNegative: LEADING_MINUS.test(account.amountText),
    })),
  );

  protected updateAccount(
    id: number,
    changes: Partial<Omit<AccountRow, 'id'>>,
  ): void {
    this.accounts.update((accounts) =>
      accounts.map((account) =>
        account.id === id ? { ...account, ...changes } : account,
      ),
    );
  }

  // The keypad has no minus key on most phones, so the sign is a button. It
  // edits the typed text rather than a separate flag: what the field shows is
  // what gets summed.
  protected toggleNegative(id: number): void {
    const account = this.accounts().find((row) => row.id === id);
    if (!account) return;
    const amountText = LEADING_MINUS.test(account.amountText)
      ? account.amountText.replace(LEADING_MINUS, '')
      : `-${account.amountText.trim()}`;
    this.updateAccount(id, { amountText });
  }

  protected addAccount(): void {
    this.accounts.update((accounts) => [
      ...accounts,
      { id: this.#nextAccountId++, label: '', amountText: '' },
    ]);
    afterNextRender(() => this.labelInputs().at(-1)?.nativeElement.focus(), {
      injector: this.#injector,
    });
  }

  // Enter adds the next account rather than submitting anything: the step has
  // no form to submit, and a reflex Enter must never move money.
  protected addAccountFromKeyboard(event: Event): void {
    event.preventDefault();
    this.addAccount();
  }

  protected removeAccount(id: number): void {
    const index = this.accounts().findIndex((account) => account.id === id);
    if (index <= 0) return;
    this.accounts.update((accounts) =>
      accounts.filter((account) => account.id !== id),
    );
    // Focus lands on the account above, rather than on the page body.
    afterNextRender(
      () => this.amountInputs()[index - 1]?.nativeElement.focus(),
      { injector: this.#injector },
    );
  }

  protected next(): void {
    const step = this.step();
    if (!this.summary().canContinue || step === 3) return;
    this.#goTo((step + 1) as Step);
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
      this.#dialogRef.close();
    } finally {
      this.isRecording.set(false);
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
    this.close();
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
