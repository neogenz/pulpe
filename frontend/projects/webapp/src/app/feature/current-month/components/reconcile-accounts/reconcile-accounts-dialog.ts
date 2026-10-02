import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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
import type { ErrorStateMatcher } from '@angular/material/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ANALYTICS_EVENTS,
  CURRENCY_METADATA,
  type BudgetPeriodDates,
  type SupportedCurrency,
} from 'pulpe-shared';
import { filter, merge } from 'rxjs';

import { PostHogService } from '@core/analytics/posthog';
import { AppCurrencyPipe } from '@core/currency';
import {
  parseAccountAmount,
  reconciliationVerdict,
  summarizeAccounts,
} from './reconcile-accounts';

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
  /** Read live, so a refresh landing mid-flow moves the comparison with it. */
  readonly realized: Signal<RealizedPosition>;
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
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  template: `
    <h2 mat-dialog-title class="text-headline-small text-on-surface pr-16!">
      {{ 'currentMonth.reconcile.title' | transloco }}
    </h2>
    <button
      matIconButton
      class="absolute! top-3 right-3 z-10"
      (click)="close()"
      [disabled]="isRecording()"
      [attr.aria-label]="'currentMonth.reconcile.close' | transloco"
      data-testid="reconcile-close-button"
    >
      <mat-icon aria-hidden="true">close</mat-icon>
    </button>

    <mat-dialog-content class="reconcile-content">
      <p class="text-label-large text-on-surface-variant m-0 mb-2">
        {{ 'currentMonth.reconcile.stepOf' | transloco: { step: step() } }}
      </p>
      @switch (step()) {
        @case (1) {
          <section data-testid="reconcile-accounts-step">
            <h3
              #stepHeading
              tabindex="-1"
              class="step-heading text-title-large text-on-surface m-0 mb-2"
              data-testid="reconcile-step-heading"
            >
              {{ 'currentMonth.reconcile.accounts.heading' | transloco }}
            </h3>
            <p class="text-body-medium text-on-surface-variant m-0 mb-4">
              {{ 'currentMonth.reconcile.accounts.hint' | transloco }}
            </p>

            <div class="flex flex-col gap-4">
              @for (
                account of accountViews();
                track account.id;
                let index = $index
              ) {
                <div class="account-row">
                  @if (index > 0) {
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      class="account-label ph-no-capture"
                    >
                      <mat-label>{{
                        'currentMonth.reconcile.accounts.accountName'
                          | transloco
                      }}</mat-label>
                      <input
                        #labelInput
                        matInput
                        autocomplete="off"
                        maxlength="60"
                        [ngModel]="account.label"
                        (ngModelChange)="
                          updateAccount(account.id, { label: $event })
                        "
                        (keydown.enter)="addAccountFromKeyboard($event)"
                        data-testid="reconcile-label-input"
                      />
                    </mat-form-field>
                  }
                  <div class="account-amount">
                    <mat-form-field
                      appearance="outline"
                      subscriptSizing="dynamic"
                      class="flex-1 min-w-0 ph-no-capture"
                    >
                      <mat-label>{{
                        (index === 0
                          ? 'currentMonth.reconcile.accounts.firstAmount'
                          : 'currentMonth.reconcile.accounts.amount'
                        ) | transloco
                      }}</mat-label>
                      <input
                        #amountInput
                        matInput
                        inputmode="decimal"
                        autocomplete="off"
                        class="tabular-nums"
                        [ngModel]="account.amountText"
                        (ngModelChange)="
                          updateAccount(account.id, { amountText: $event })
                        "
                        [errorStateMatcher]="unreadableAmount"
                        (keydown.enter)="addAccountFromKeyboard($event)"
                        data-testid="reconcile-amount-input"
                      />
                      <span matTextSuffix>{{ currencySymbol() }}</span>
                      <mat-error>{{
                        'currentMonth.reconcile.accounts.invalidAmount'
                          | transloco
                      }}</mat-error>
                    </mat-form-field>
                    <button
                      matIconButton
                      type="button"
                      class="shrink-0"
                      [attr.aria-pressed]="account.isNegative"
                      [class.sign-toggle-active]="account.isNegative"
                      [attr.aria-label]="
                        'currentMonth.reconcile.accounts.negative' | transloco
                      "
                      [matTooltip]="
                        'currentMonth.reconcile.accounts.negative' | transloco
                      "
                      (click)="toggleNegative(account.id)"
                      data-testid="reconcile-negative-toggle"
                    >
                      <mat-icon aria-hidden="true">exposure</mat-icon>
                    </button>
                    @if (index > 0) {
                      <!-- Numbered, never named: session replay records this
                       attribute, and an account name is the user's own text. -->
                      <button
                        matIconButton
                        type="button"
                        class="shrink-0"
                        [attr.aria-label]="
                          'currentMonth.reconcile.accounts.removeNumbered'
                            | transloco: { index: index + 1 }
                        "
                        (click)="removeAccount(account.id)"
                        data-testid="reconcile-remove-button"
                      >
                        <mat-icon aria-hidden="true">delete</mat-icon>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <button
              matButton
              type="button"
              class="mt-2"
              (click)="addAccount()"
              data-testid="reconcile-add-account-button"
            >
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'currentMonth.reconcile.accounts.addAccount' | transloco }}
            </button>
          </section>
        }
        @case (2) {
          @let realized = data.realized();
          <section data-testid="reconcile-realized-step">
            <h3
              #stepHeading
              tabindex="-1"
              class="step-heading text-title-large text-on-surface m-0 mb-1"
              data-testid="reconcile-step-heading"
            >
              {{ 'currentMonth.reconcile.realized.heading' | transloco }}
            </h3>
            @if (periodRange(); as range) {
              <p
                class="text-body-medium text-on-surface-variant m-0"
                data-testid="reconcile-period"
              >
                {{
                  'currentMonth.reconcile.realized.period' | transloco: range
                }}
              </p>
            }
            <dl class="breakdown ph-no-capture tabular-nums">
              <div>
                <dt>
                  {{
                    'currentMonth.reconcile.realized.checkedIncome' | transloco
                  }}
                </dt>
                <dd data-testid="reconcile-checked-income">
                  {{
                    realized.checkedIncome
                      | appCurrency: data.currency() : '1.2-2'
                  }}
                </dd>
              </div>
              <div>
                <dt>
                  {{
                    'currentMonth.reconcile.realized.checkedOutflows'
                      | transloco
                  }}
                </dt>
                <dd data-testid="reconcile-checked-outflows">
                  {{
                    0 - realized.checkedOutflows
                      | appCurrency: data.currency() : '1.2-2'
                  }}
                </dd>
              </div>
              <div>
                <dt>
                  {{ 'currentMonth.reconcile.realized.rollover' | transloco }}
                </dt>
                <dd data-testid="reconcile-rollover">
                  {{
                    realized.rollover | appCurrency: data.currency() : '1.2-2'
                  }}
                </dd>
              </div>
              <div class="breakdown-total">
                <dt>
                  {{ 'currentMonth.reconcile.realized.balance' | transloco }}
                </dt>
                <dd data-testid="reconcile-realized-balance">
                  {{
                    realized.balance | appCurrency: data.currency() : '1.2-2'
                  }}
                </dd>
              </div>
            </dl>
            <p class="text-body-medium text-on-surface-variant m-0 mb-2">
              {{ 'currentMonth.reconcile.realized.hint' | transloco }}
            </p>
            <button
              matButton
              type="button"
              (click)="viewItemsToCheck()"
              data-testid="reconcile-view-items-button"
            >
              {{
                'currentMonth.reconcile.realized.viewItemsToCheck' | transloco
              }}
              <mat-icon iconPositionEnd aria-hidden="true"
                >arrow_forward</mat-icon
              >
            </button>
          </section>
        }
        @case (3) {
          @let currentVerdict = verdict();
          <section data-testid="reconcile-verdict-step">
            @if (
              currentVerdict === null || currentVerdict.kind === 'upToDate'
            ) {
              <h3
                #stepHeading
                tabindex="-1"
                class="step-heading text-title-large text-on-surface m-0 mb-2"
                data-testid="reconcile-verdict-title"
              >
                {{ 'currentMonth.reconcile.verdict.upToDateTitle' | transloco }}
              </h3>
              <p
                class="text-body-large text-on-surface-variant m-0"
                data-testid="reconcile-verdict-message"
              >
                {{
                  'currentMonth.reconcile.verdict.upToDateMessage' | transloco
                }}
              </p>
            } @else {
              @let gap =
                currentVerdict.amount | appCurrency: data.currency() : '1.2-2';
              <h3
                #stepHeading
                tabindex="-1"
                class="step-heading text-title-large text-on-surface m-0 mb-2 ph-no-capture tabular-nums"
                data-testid="reconcile-verdict-title"
              >
                {{
                  (currentVerdict.kind === 'income'
                    ? 'currentMonth.reconcile.verdict.moreTitle'
                    : 'currentMonth.reconcile.verdict.lessTitle'
                  ) | transloco: { amount: gap }
                }}
              </h3>
              <p
                class="text-body-large text-on-surface-variant m-0 mb-4 ph-no-capture"
                data-testid="reconcile-verdict-message"
              >
                {{
                  (currentVerdict.kind === 'income'
                    ? 'currentMonth.reconcile.verdict.moreMessage'
                    : 'currentMonth.reconcile.verdict.lessMessage'
                  ) | transloco: { amount: gap }
                }}
              </p>
              <mat-form-field
                appearance="outline"
                subscriptSizing="dynamic"
                class="w-full ph-no-capture"
              >
                <mat-label>{{
                  'currentMonth.reconcile.verdict.label' | transloco
                }}</mat-label>
                <!-- Enter does nothing here: recording moves money, so it takes
                 the button, never a reflex keystroke. -->
                <input
                  matInput
                  autocomplete="off"
                  maxlength="100"
                  [ngModel]="adjustmentLabel()"
                  (ngModelChange)="adjustmentLabel.set($event)"
                  [errorStateMatcher]="blankLabel"
                  (keydown.enter)="$event.preventDefault()"
                  data-testid="reconcile-adjustment-label-input"
                />
                <mat-error>{{
                  'currentMonth.reconcile.verdict.labelRequired' | transloco
                }}</mat-error>
              </mat-form-field>
            }
          </section>
        }
      }
    </mat-dialog-content>

    @if (step() === 1) {
      <p
        class="total-row text-title-medium m-0 px-6 pt-3 pb-1 shrink-0"
        aria-live="polite"
        data-testid="reconcile-total"
      >
        <span>{{ 'currentMonth.reconcile.accounts.total' | transloco }}</span>
        <span class="ph-no-capture tabular-nums font-bold">
          @let totalCents = summary().totalCents;
          @if (totalCents === null) {
            —
          } @else {
            {{
              totalCents / centsPerUnit | appCurrency: data.currency() : '1.2-2'
            }}
          }
        </span>
      </p>
    }

    <mat-dialog-actions align="end">
      <button
        matButton="outlined"
        (click)="back()"
        [disabled]="isRecording()"
        data-testid="reconcile-back-button"
      >
        {{ 'currentMonth.reconcile.back' | transloco }}
      </button>
      @if (step() < 3) {
        <button
          matButton="filled"
          (click)="next()"
          [disabled]="!summary().canContinue"
          data-testid="reconcile-next-button"
        >
          {{ 'currentMonth.reconcile.continue' | transloco }}
        </button>
      } @else if (adjustment()) {
        <button
          matButton="filled"
          (click)="record()"
          [disabled]="!canRecord()"
          data-testid="reconcile-record-button"
        >
          <span class="flex items-center justify-center">
            @if (isRecording()) {
              <mat-spinner diameter="20" class="mr-2" />
            }
            {{ 'currentMonth.reconcile.verdict.record' | transloco }}
          </span>
        </button>
      } @else {
        <button
          matButton="filled"
          (click)="finish()"
          [disabled]="!canFinish()"
          data-testid="reconcile-finish-button"
        >
          {{ 'currentMonth.reconcile.verdict.finish' | transloco }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    /* Full height on a phone: the steps scroll between a fixed title and
       fixed actions, so Continue never leaves the screen above the keyboard. */
    :host-context(.full-screen-dialog) .reconcile-content {
      max-height: none;
      flex: 1 1 auto;
    }

    /* Focused by the step change, not by the user: no ring on a heading. */
    .step-heading:focus {
      outline: none;
    }

    .account-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .account-amount {
      display: flex;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .account-amount .mat-mdc-icon-button {
      margin-top: 0.25rem;
    }

    /* Pressed reads as a state, not as a colour alone: the icon fills too. */
    .sign-toggle-active {
      color: var(--mat-sys-primary);
      background: var(--mat-sys-secondary-container);
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-top: 0.75rem;
      border-top: var(--pulpe-surface-border-subtle);
    }

    .breakdown {
      margin: 1rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .breakdown > div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      font: var(--mat-sys-body-large);
    }

    .breakdown dd {
      margin: 0;
      white-space: nowrap;
    }

    .breakdown-total {
      padding-top: 0.5rem;
      border-top: var(--pulpe-surface-border-subtle);
      font-weight: 700;
    }
  `,
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
    return totalCents === null
      ? null
      : reconciliationVerdict(totalCents, this.data.realized().balance);
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
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), {
      injector: this.#injector,
    });
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
