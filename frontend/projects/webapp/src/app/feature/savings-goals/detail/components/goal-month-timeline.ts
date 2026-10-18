import {
  DatePipe,
  formatDate,
  formatNumber,
  NgTemplateOutlet,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { type ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput, MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CURRENCY_METADATA,
  formatBudgetPeriod,
  type SavingsGoalContribution,
  type SavingsGoalPlanMonth,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalWithdrawal,
  type SavingsPlanSimulatedMonth,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import {
  buildGoalMonthTimeline,
  type GoalMonthEntry,
  type GoalWithdrawalEntry,
  windowGoalTimeline,
} from './goal-month-timeline.view-model';

// Mobile: two lines (period + amount, status + balance), cells placed
// explicitly so the DOM keeps the desktop column order.
const READ_GRID =
  'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[10rem_minmax(0,1fr)_7rem_7rem_8rem_2.5rem]';
const SIMULATION_GRID =
  'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,22rem)_8rem]';
const ROW =
  'grid items-center gap-x-4 gap-y-1 border-t border-outline-variant px-4 py-3 sm:px-5 sm:py-4';
const CHIP =
  'text-label-small font-medium rounded-full px-2 py-0.5 shrink-0 bg-surface-container-high text-on-surface-variant';
const SKELETON =
  'inline-block animate-pulse motion-reduce:animate-none rounded-full bg-surface-container-high';

/**
 * « Mois par mois » (docs/SAVINGS.md §10.1). The plan, its real contributions
 * and the withdrawals on ONE line of time: contributions and withdrawals move
 * the same stock, so the « Solde après » column only reads right when both sit
 * in the order they happen. A withdrawal keeps its negative sign but the
 * current text colour — a choice, never an anomaly (RG-002). Rows come from the
 * pure view model; this component only renders them and owns the inline edit.
 */
@Component({
  selector: 'pulpe-goal-month-timeline',
  imports: [
    DatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  providers: [AppCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3" data-testid="goal-plan-timeline">
      @if (hasWithdrawalsError() && !editable()) {
        <div
          role="alert"
          class="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-body-medium text-on-surface-variant"
          data-testid="goal-withdrawals-error"
        >
          <span class="min-w-0 flex-1">
            {{ 'savingsGoals.detail.withdrawalsError' | transloco }}
          </span>
          <button
            matButton
            type="button"
            (click)="retryRequested.emit()"
            data-testid="goal-withdrawals-retry"
          >
            {{ 'savingsGoals.detail.withdrawalsRetry' | transloco }}
          </button>
        </div>
      }

      @if (visibleEntries().length > 0) {
        <div
          class="hidden sm:grid gap-x-4 px-5 text-label-small font-semibold uppercase tracking-wide text-on-surface-variant"
          [class]="grid()"
        >
          <span>{{ 'savingsGoals.plan.columnPeriod' | transloco }}</span>
          <span>{{ 'savingsGoals.plan.columnStatus' | transloco }}</span>
          @if (editable()) {
            <span class="text-right">
              {{ 'savingsGoals.plan.columnMovement' | transloco }}
            </span>
          } @else {
            <span class="text-right">
              {{ 'savingsGoals.plan.columnPlanned' | transloco }}
            </span>
            <span class="text-right">
              {{ 'savingsGoals.plan.columnReal' | transloco }}
            </span>
          }
          <span class="text-right">
            {{ 'savingsGoals.plan.columnBalance' | transloco }}
          </span>
        </div>

        <div
          class="flex flex-col overflow-hidden rounded-2xl bg-surface-container-low"
        >
          @for (entry of visibleEntries(); track entry.key) {
            @if (entry.showYear) {
              <div
                class="border-b-2 border-on-surface px-4 py-2 sm:px-5 text-label-large font-bold tabular-nums text-on-surface"
                data-testid="goal-plan-year"
              >
                {{ entry.year }}
              </div>
            }
            @if (entry.kind === 'month') {
              @let m = entry;
              <div
                [class]="monthRowClass(m)"
                [attr.data-testid]="'goal-plan-row-' + m.periodKey"
                [attr.data-current]="m.isCurrent"
                [attr.data-locked]="m.isLocked"
              >
                <div
                  class="flex min-w-0 flex-col max-sm:col-start-1 max-sm:row-start-1"
                >
                  <span class="flex flex-wrap items-center gap-2">
                    <span
                      class="text-body-large capitalize"
                      [class.font-semibold]="!m.isCurrent"
                      [class.font-bold]="m.isCurrent"
                    >
                      {{ periodDate(m) | date: 'MMMM' }}
                    </span>
                    @if (m.isCurrent) {
                      <span
                        class="text-label-small font-medium rounded-full px-2 py-0.5 shrink-0 bg-primary text-on-primary"
                        data-testid="goal-plan-current-badge"
                      >
                        {{ 'savingsGoals.plan.currentMonth' | transloco }}
                      </span>
                    }
                  </span>
                  @if (m.isCurrent) {
                    <span class="text-body-small text-on-surface-variant">
                      {{ periodRange(m) }}
                    </span>
                  }
                </div>

                @if (!editable()) {
                  <span
                    class="ph-no-capture text-right text-body-medium font-semibold tabular-nums sm:hidden max-sm:col-start-2 max-sm:row-start-1"
                  >
                    @if (m.realAmount !== null && m.amount !== null) {
                      {{ m.realAmount | appCurrency: currency() : '1.0-0' }}
                      /
                    }
                    @if (m.amount !== null) {
                      {{ m.amount | appCurrency: currency() : '1.0-2' }}
                    } @else if (m.status === 'withdrawnSoFar') {
                      {{ -m.withdrawn | appCurrency: currency() : '1.0-2' }}
                    } @else {
                      &mdash;
                    }
                  </span>
                }

                <div
                  class="flex min-w-0 flex-col gap-1 max-sm:col-start-1 max-sm:row-start-2"
                >
                  <span
                    class="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-medium"
                  >
                    @switch (m.status) {
                      @case ('checked') {
                        <span
                          class="flex items-center gap-1 font-medium text-financial-savings"
                        >
                          <mat-icon class="mat-icon-sm" aria-hidden="true"
                            >check</mat-icon
                          >
                          {{
                            'savingsGoals.detail.contributionChecked'
                              | transloco
                          }}
                        </span>
                      }
                      @case ('toCheck') {
                        <span
                          class="flex items-center gap-1 font-medium text-on-surface-variant"
                        >
                          <mat-icon class="mat-icon-sm" aria-hidden="true"
                            >schedule</mat-icon
                          >
                          {{
                            'savingsGoals.detail.contributionUnchecked'
                              | transloco
                          }}
                        </span>
                      }
                      @case ('upcoming') {
                        <span class="text-on-surface-variant">
                          {{ 'savingsGoals.plan.statusUpcoming' | transloco }}
                        </span>
                      }
                      @case ('repair') {
                        <span
                          class="text-label-small font-medium rounded-full px-2 py-0.5 shrink-0 bg-financial-savings/10 text-financial-savings"
                          data-testid="goal-plan-repair-chip"
                        >
                          {{ 'savingsGoals.plan.repairChip' | transloco }}
                        </span>
                      }
                      @case ('noForecast') {
                        <span
                          [class]="chip"
                          data-testid="goal-plan-no-forecast-chip"
                        >
                          {{ 'savingsGoals.plan.noForecastChip' | transloco }}
                        </span>
                      }
                      @case ('gap') {
                        <span [class]="chip" data-testid="goal-plan-gap-chip">
                          {{ 'savingsGoals.plan.gapChip' | transloco }}
                        </span>
                      }
                      @case ('withdrawnSoFar') {
                        <span
                          [class]="chip"
                          data-testid="goal-plan-withdrawal-chip"
                        >
                          {{ 'savingsGoals.plan.withdrawnSoFar' | transloco }}
                        </span>
                      }
                    }
                    @if (m.lineCount > 1) {
                      <span class="text-on-surface-variant">
                        &middot;
                        {{
                          'savingsGoals.plan.forecastCount'
                            | transloco: { count: m.lineCount }
                        }}
                      </span>
                    }
                  </span>
                  @if (m.blockedByRealization) {
                    <span
                      class="flex items-start gap-1 text-body-small text-on-surface-variant"
                      data-testid="goal-plan-row-realized-lock"
                    >
                      <mat-icon class="mat-icon-sm shrink-0" aria-hidden="true"
                        >lock</mat-icon
                      >
                      {{
                        'savingsGoals.plan.realizedWithdrawalLock' | transloco
                      }}
                    </span>
                    @if (m.withdrawalBudgetId) {
                      <a
                        matButton
                        class="w-fit"
                        [routerLink]="['/budget', m.withdrawalBudgetId]"
                        data-testid="goal-plan-row-open-budget"
                      >
                        {{
                          'savingsGoals.plan.openWithdrawalBudget'
                            | transloco: { period: monthYear(m) }
                        }}
                        <mat-icon>arrow_forward</mat-icon>
                      </a>
                    }
                  }
                </div>

                @if (editable()) {
                  <div
                    class="flex min-w-0 sm:justify-end"
                    [class]="
                      editingKey() === m.periodKey
                        ? 'max-sm:col-span-full max-sm:row-start-3'
                        : 'max-sm:col-start-2 max-sm:row-start-1 justify-end'
                    "
                  >
                    @if (m.isOpen && editingKey() === m.periodKey) {
                      <mat-form-field
                        appearance="outline"
                        subscriptSizing="dynamic"
                        class="ph-no-capture w-full"
                      >
                        <mat-label>
                          {{ 'savingsGoals.plan.editAmount' | transloco }}
                        </mat-label>
                        <input
                          matInput
                          type="number"
                          inputmode="decimal"
                          step="0.01"
                          class="text-right"
                          [attr.value]="m.amount"
                          [errorStateMatcher]="editErrorMatcher"
                          (input)="onAmountInput(m, $event)"
                          (blur)="closeEdit()"
                          (keydown.enter)="closeEdit()"
                          #amountField
                          data-testid="goal-plan-row-input"
                        />
                        <span matTextSuffix>{{ currencySymbol() }}</span>
                        <mat-hint>
                          {{ 'savingsGoals.plan.movementHint' | transloco }}
                        </mat-hint>
                        <mat-error data-testid="goal-plan-row-error">
                          {{
                            'savingsGoals.plan.editAmountInvalid' | transloco
                          }}
                        </mat-error>
                      </mat-form-field>
                    } @else if (m.isOpen) {
                      <button
                        matButton
                        (click)="startEdit(m.periodKey)"
                        [attr.data-testid]="'goal-plan-row-edit-' + m.periodKey"
                      >
                        <span
                          class="ph-no-capture text-body-medium font-semibold tabular-nums"
                          [class.text-financial-savings]="m.isAdjusted"
                        >
                          {{ m.amount | appCurrency: currency() : '1.0-2' }}
                        </span>
                        <mat-icon
                          class="text-base! w-auto! h-auto! leading-none ml-1"
                          >edit</mat-icon
                        >
                      </button>
                    } @else {
                      <span
                        class="ph-no-capture text-body-medium font-semibold tabular-nums"
                        [class.text-financial-savings]="m.isAdjusted"
                        [attr.aria-label]="lockedAmountLabel(m)"
                      >
                        {{ m.amount | appCurrency: currency() : '1.0-2' }}
                      </span>
                    }
                  </div>
                } @else {
                  <span
                    class="ph-no-capture hidden sm:block text-right text-body-medium tabular-nums text-on-surface-variant"
                    [attr.aria-label]="lockedAmountLabel(m)"
                  >
                    @if (m.amount !== null) {
                      {{ m.amount | appCurrency: currency() : '1.0-2' }}
                    } @else {
                      &mdash;
                    }
                  </span>
                  <span
                    class="ph-no-capture hidden sm:block text-right text-body-medium font-semibold tabular-nums"
                  >
                    @if (m.status === 'withdrawnSoFar') {
                      <span data-testid="goal-plan-row-withdrawn">
                        {{ -m.withdrawn | appCurrency: currency() : '1.0-2' }}
                      </span>
                    } @else if (m.realAmount !== null) {
                      {{ m.realAmount | appCurrency: currency() : '1.0-0' }}
                    } @else {
                      <span class="font-normal text-on-surface-variant"
                        >&mdash;</span
                      >
                    }
                  </span>
                }

                <span
                  class="text-right text-body-medium tabular-nums max-sm:col-start-2 max-sm:row-start-2 max-sm:text-body-small"
                  [class.font-semibold]="m.isCurrent"
                  [class.text-on-surface-variant]="!m.isCurrent"
                >
                  @if (m.isBalancePending) {
                    <span
                      [class]="skeleton + ' h-3 w-16'"
                      data-testid="goal-plan-balance-pending"
                    ></span>
                  } @else {
                    <span class="sm:hidden">{{
                      'savingsGoals.plan.balanceShort' | transloco
                    }}</span>
                    <span class="ph-no-capture">
                      {{ m.balance | appCurrency: currency() : '1.0-0' }}
                    </span>
                  }
                </span>

                @if (!editable()) {
                  <span class="hidden sm:flex justify-end">
                    @if (m.transactions.length > 0) {
                      <button
                        matIconButton
                        type="button"
                        [attr.aria-expanded]="isExpanded(m.periodKey)"
                        [attr.aria-label]="
                          'savingsGoals.plan.realToggle'
                            | transloco: { period: monthYear(m) }
                        "
                        (click)="toggleReal(m.periodKey)"
                        data-testid="goal-plan-real-toggle-button"
                      >
                        <mat-icon>{{
                          isExpanded(m.periodKey)
                            ? 'expand_less'
                            : 'expand_more'
                        }}</mat-icon>
                      </button>
                    }
                  </span>
                }

                @if (m.transactions.length > 0) {
                  <!-- Always open on mobile, behind the chevron on desktop. -->
                  <div
                    class="col-span-full flex-col gap-2 pt-2 sm:pl-44"
                    [class]="
                      isExpanded(m.periodKey) ? 'flex' : 'flex sm:hidden'
                    "
                  >
                    <span
                      class="text-label-small font-semibold text-on-surface-variant"
                    >
                      {{
                        'savingsGoals.detail.contributionTransactions'
                          | transloco
                      }}
                    </span>
                    @for (tx of m.transactions; track tx.id) {
                      <div
                        class="flex items-center gap-3 rounded-lg bg-surface-container-high px-3 py-2"
                        data-testid="goal-plan-real-transaction"
                      >
                        <mat-icon
                          class="mat-icon-sm shrink-0"
                          [class.text-financial-savings]="!!tx.checkedAt"
                          [class.text-on-surface-variant]="!tx.checkedAt"
                          aria-hidden="true"
                          >{{
                            tx.checkedAt ? 'check_circle' : 'schedule'
                          }}</mat-icon
                        >
                        <div class="flex min-w-0 flex-1 flex-col">
                          <span
                            class="ph-no-capture truncate text-body-medium font-medium"
                            >{{ tx.name }}</span
                          >
                          <span class="text-body-small text-on-surface-variant">
                            {{ tx.transactionDate | date: shortDateFormat() }}
                            &middot;
                            {{
                              (tx.checkedAt
                                ? 'savingsGoals.detail.contributionChecked'
                                : 'savingsGoals.detail.contributionUnchecked'
                              ) | transloco
                            }}
                          </span>
                        </div>
                        <span
                          class="ph-no-capture text-body-medium font-medium tabular-nums"
                        >
                          {{ tx.amount | appCurrency: currency() : '1.2-2' }}
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>
            } @else if (entry.kind === 'withdrawal') {
              @let w = entry;
              <ng-template #withdrawalCells>
                <span
                  class="flex min-w-0 flex-col max-sm:col-start-1 max-sm:row-start-1"
                >
                  <span
                    class="flex items-center gap-1 text-label-large font-semibold text-financial-negative"
                  >
                    <mat-icon class="mat-icon-sm" aria-hidden="true"
                      >call_made</mat-icon
                    >
                    {{ 'savingsGoals.plan.withdrawalLabel' | transloco }}
                  </span>
                  @if (w.date) {
                    <span class="text-body-small text-on-surface-variant">
                      {{ w.date | date: shortDateFormat() }}
                    </span>
                  } @else if (w.showPeriod) {
                    <span
                      class="text-body-small capitalize text-on-surface-variant"
                    >
                      {{ monthYear(w) }}
                    </span>
                  }
                </span>
                <span
                  class="ph-no-capture text-right text-body-medium font-semibold tabular-nums sm:hidden max-sm:col-start-2 max-sm:row-start-1"
                >
                  {{
                    -(w.realized ?? w.planned ?? 0)
                      | appCurrency: currency() : '1.0-2'
                  }}
                </span>
                <span
                  class="flex min-w-0 flex-col max-sm:col-start-1 max-sm:row-start-2"
                >
                  <span
                    class="ph-no-capture truncate text-body-medium font-medium"
                    >{{ w.name }}</span
                  >
                  <span
                    class="text-body-small"
                    [class.text-financial-savings]="
                      w.source === 'realized' || w.status === 'realized'
                    "
                    [class.text-on-surface-variant]="
                      w.source !== 'realized' && w.status !== 'realized'
                    "
                  >
                    {{ withdrawalStatus(w) }}
                    @if (w.status === 'partially_realized') {
                      &middot;
                      <span class="ph-no-capture">{{
                        'savingsGoals.detail.withdrawalRemainingShort'
                          | transloco
                            : {
                                amount:
                                  (-w.remaining
                                  | appCurrency: currency() : '1.0-2'),
                              }
                      }}</span>
                    }
                  </span>
                </span>
                <span
                  class="ph-no-capture hidden sm:block text-right text-body-medium tabular-nums text-on-surface-variant"
                >
                  @if (w.planned !== null) {
                    {{ -w.planned | appCurrency: currency() : '1.0-2' }}
                  } @else {
                    &mdash;
                  }
                </span>
                <span
                  class="ph-no-capture hidden sm:block text-right text-body-medium font-semibold tabular-nums"
                >
                  @if (w.realized !== null) {
                    {{ -w.realized | appCurrency: currency() : '1.0-2' }}
                  } @else {
                    <span class="font-normal text-on-surface-variant"
                      >&mdash;</span
                    >
                  }
                </span>
                <span
                  class="text-right text-body-medium tabular-nums text-on-surface-variant max-sm:col-start-2 max-sm:row-start-2 max-sm:text-body-small"
                >
                  @if (w.balance !== null) {
                    <span class="sm:hidden">{{
                      'savingsGoals.plan.balanceShort' | transloco
                    }}</span>
                    <span class="ph-no-capture">
                      {{ w.balance | appCurrency: currency() : '1.0-0' }}
                    </span>
                  } @else {
                    &mdash;
                  }
                </span>
                <span class="hidden sm:flex justify-end">
                  @if (w.budgetId) {
                    <mat-icon class="text-on-surface-variant" aria-hidden="true"
                      >chevron_right</mat-icon
                    >
                  }
                </span>
              </ng-template>
              @if (w.budgetId) {
                <a
                  [class]="withdrawalRowClass(w)"
                  class="no-underline text-on-surface hover:bg-surface-container-high"
                  [routerLink]="['/budget', w.budgetId]"
                  [attr.aria-label]="withdrawalAria(w)"
                  [attr.data-testid]="
                    w.source === 'realized'
                      ? 'savings-goal-withdrawal-row'
                      : 'savings-goal-planned-withdrawal-row'
                  "
                >
                  <ng-container [ngTemplateOutlet]="withdrawalCells" />
                </a>
              } @else {
                <div
                  [class]="withdrawalRowClass(w)"
                  [attr.aria-label]="withdrawalAria(w)"
                  data-testid="savings-goal-plan-only-withdrawal-row"
                >
                  <ng-container [ngTemplateOutlet]="withdrawalCells" />
                </div>
              }
            } @else {
              <div
                role="status"
                class="flex items-center gap-4 border-t border-dashed border-outline-variant bg-financial-negative-light/20 px-4 py-4 sm:px-5"
                [attr.aria-label]="
                  'savingsGoals.detail.withdrawalsLoading' | transloco
                "
                data-testid="goal-withdrawals-loading"
              >
                <span [class]="skeleton + ' h-3 w-16'"></span>
                <span [class]="skeleton + ' h-3 w-40'"></span>
                <span [class]="skeleton + ' ml-auto h-3 w-16'"></span>
              </div>
            }
          }
        </div>
      }

      @if (hiddenCount() > 0) {
        <button
          matButton
          class="self-center"
          (click)="toggleExpanded.emit()"
          data-testid="goal-plan-see-all"
        >
          @if (expanded()) {
            {{ 'savingsGoals.plan.seeLess' | transloco }}
          } @else {
            {{
              'savingsGoals.plan.seeAll' | transloco: { count: monthCount() }
            }}
          }
        </button>
      }

      @if (gapCount() > 0) {
        <p
          class="text-body-small text-on-surface-variant"
          data-testid="goal-plan-gap-hint"
        >
          {{ 'savingsGoals.plan.gapHint' | transloco: { count: gapCount() } }}
        </p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class GoalMonthTimeline {
  readonly #transloco = inject(TranslocoService);
  readonly #currencyPipe = inject(AppCurrencyPipe);
  readonly #appLocale = inject(LOCALE_ID);

  readonly months = input.required<readonly SavingsGoalPlanMonth[]>();
  readonly simulatedMonths = input<readonly SavingsPlanSimulatedMonth[] | null>(
    null,
  );
  readonly contributions = input<readonly SavingsGoalContribution[]>([]);
  readonly plannedWithdrawals = input<readonly SavingsGoalPlannedWithdrawal[]>(
    [],
  );
  readonly planOnlyWithdrawals = input<
    readonly SavingsGoalPlanOnlyWithdrawal[]
  >([]);
  readonly withdrawals = input<readonly SavingsGoalWithdrawal[]>([]);
  readonly isWithdrawalsLoading = input(false);
  readonly hasWithdrawalsError = input(false);
  readonly currency = input.required<SupportedCurrency>();
  readonly locale = input.required<string>();
  readonly payDayOfMonth = input<number | null>(null);
  readonly editable = input<boolean>(false);
  readonly expanded = input<boolean>(false);
  readonly canRepair = input<boolean>(false);

  readonly amountChange = output<{
    month: number;
    year: number;
    amount: number;
  }>();
  /** La saisie en cours est refusée : le parent referme « Appliquer ». */
  readonly invalidChange = output<boolean>();
  readonly toggleExpanded = output<void>();
  readonly retryRequested = output<void>();

  protected readonly chip = CHIP;
  protected readonly skeleton = SKELETON;
  protected readonly editingKey = signal<number | null>(null);
  protected readonly hasEditError = signal(false);
  readonly #expandedKeys = signal<ReadonlySet<number>>(new Set());

  /** No reactive-forms control here: the error is the local parse verdict. */
  protected readonly editErrorMatcher: ErrorStateMatcher = {
    isErrorState: () => this.hasEditError(),
  };

  // Focus the inline field when it appears (user opened it) — a11y-friendly
  // alternative to the banned `autofocus` attribute.
  private readonly amountField =
    viewChild<ElementRef<HTMLInputElement>>('amountField');
  // Without a forms control, MatInput never re-reads its matcher on its own.
  private readonly amountInput = viewChild('amountField', { read: MatInput });

  constructor() {
    effect(() => this.amountField()?.nativeElement.focus());
    effect(() => {
      this.hasEditError();
      this.amountInput()?.updateErrorState();
    });
  }

  readonly #timeline = computed(() =>
    buildGoalMonthTimeline({
      months: this.months(),
      simulatedMonths: this.simulatedMonths(),
      contributions: this.contributions(),
      plannedWithdrawals: this.plannedWithdrawals(),
      planOnlyWithdrawals: this.planOnlyWithdrawals(),
      withdrawals: this.withdrawals(),
      isWithdrawalsLoading: this.isWithdrawalsLoading(),
      canRepair: this.canRepair(),
      payDayOfMonth: this.payDayOfMonth(),
    }),
  );

  protected readonly visibleEntries = computed(() =>
    windowGoalTimeline(this.#timeline().entries, this.expanded()),
  );
  protected readonly hiddenCount = computed(
    () => this.#timeline().entries.length - this.visibleEntries().length,
  );
  protected readonly monthCount = computed(() => this.#timeline().monthCount);
  protected readonly gapCount = computed(() => this.#timeline().gapCount);

  protected readonly grid = computed(() =>
    this.editable() ? SIMULATION_GRID : READ_GRID,
  );
  protected readonly currencySymbol = computed(
    () => CURRENCY_METADATA[this.currency()].symbol,
  );
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );
  readonly #monthYearFormat = computed(
    () => getDateDisplayFormats(this.currency()).monthYear,
  );

  protected monthRowClass(row: GoalMonthEntry): string {
    const tone = row.isCurrent
      ? 'bg-financial-savings/10'
      : row.isPast
        ? 'bg-surface-container'
        : '';
    return `${ROW} ${this.grid()} ${tone}`;
  }

  protected withdrawalRowClass(row: GoalWithdrawalEntry): string {
    const tone = row.isPast
      ? 'bg-surface-container'
      : 'bg-financial-negative-light/40';
    return `${ROW} ${READ_GRID} border-dashed ${tone}`;
  }

  protected periodDate(period: { month: number; year: number }): Date {
    return new Date(period.year, period.month - 1, 1);
  }

  protected periodRange(row: GoalMonthEntry): string {
    return formatBudgetPeriod(
      row.month,
      row.year,
      this.payDayOfMonth(),
      this.locale(),
    );
  }

  protected monthYear(period: { month: number; year: number }): string {
    return formatDate(
      this.periodDate(period),
      this.#monthYearFormat(),
      this.#appLocale,
    );
  }

  protected isExpanded(periodKey: number): boolean {
    return this.#expandedKeys().has(periodKey);
  }

  protected toggleReal(periodKey: number): void {
    this.#expandedKeys.update((keys) => {
      const next = new Set(keys);
      if (!next.delete(periodKey)) next.add(periodKey);
      return next;
    });
  }

  protected lockedAmountLabel(row: GoalMonthEntry): string | null {
    if (row.blockedByRealization) {
      return this.#transloco.translate(
        'savingsGoals.plan.realizedWithdrawalLock',
      );
    }
    if (!row.isChecked || row.amount === null) return null;
    const amount = `${formatNumber(row.amount, this.locale(), '1.0-2')} ${this.currency()}`;
    return this.#transloco.translate('savingsGoals.detail.lockedAmountAria', {
      amount,
    });
  }

  protected withdrawalStatus(row: GoalWithdrawalEntry): string {
    const t = (key: string) => this.#transloco.translate(key);
    if (row.source === 'planOnly') {
      return t('savingsGoals.detail.withdrawalPlanOnlyOrigin');
    }
    if (row.source === 'realized') {
      return `${t('savingsGoals.detail.withdrawalRealized')} · ${t(
        row.isChecked
          ? 'savingsGoals.detail.withdrawalChecked'
          : 'savingsGoals.detail.withdrawalUnchecked',
      )}`;
    }
    if (row.status === 'realized') {
      return t('savingsGoals.detail.withdrawalRealized');
    }
    return t(
      row.status === 'partially_realized'
        ? 'savingsGoals.detail.withdrawalPartiallyRealized'
        : 'savingsGoals.detail.withdrawalToRealize',
    );
  }

  protected withdrawalAria(row: GoalWithdrawalEntry): string {
    const money = (amount: number) =>
      this.#currencyPipe.transform(amount, this.currency(), '1.2-2') ?? '';
    if (row.source === 'planOnly') {
      return this.#transloco.translate(
        'savingsGoals.detail.withdrawalPlanOnlyAria',
        {
          name: row.name,
          period: this.monthYear(row),
          planned: money(row.planned ?? 0),
        },
      );
    }
    if (row.source === 'realized') {
      return this.#transloco.translate(
        'savingsGoals.detail.withdrawalRealizedAria',
        {
          name: row.name,
          date: formatDate(
            row.date ?? '',
            this.shortDateFormat(),
            this.#appLocale,
          ),
          status: this.#transloco.translate(
            row.isChecked
              ? 'savingsGoals.detail.withdrawalChecked'
              : 'savingsGoals.detail.withdrawalUnchecked',
          ),
          amount: money(row.realized ?? 0),
        },
      );
    }
    return this.#transloco.translate(
      'savingsGoals.detail.withdrawalLinkedAria',
      {
        name: row.name,
        period: this.monthYear(row),
        status: this.withdrawalStatus(row),
        planned: money(row.planned ?? 0),
        realized: money(row.realized ?? 0),
        remaining: money(row.remaining),
      },
    );
  }

  protected startEdit(periodKey: number): void {
    this.#clearError();
    this.editingKey.set(periodKey);
  }

  /**
   * Émettre à chaque frappe, pas seulement au blur : « Appliquer » doit suivre
   * la saisie. Le champ mensuel accepte un mouvement signé ; seule une valeur
   * non numérique est refusée. Une saisie incomplète attend la prochaine frappe.
   */
  protected onAmountInput(row: GoalMonthEntry, event: Event): void {
    const field = event.target as HTMLInputElement;
    const raw = field.value.trim();
    if (raw === '') {
      // Champ vidé pour retaper : incomplet, pas fautif. Rien n'est appliqué.
      // Un champ number rend '' aussi pour « 12a » : badInput les distingue.
      this.hasEditError.set(field.validity.badInput);
      this.invalidChange.emit(true);
      return;
    }

    const parsed = Number.parseFloat(raw);
    const isValid = Number.isFinite(parsed);
    this.hasEditError.set(!isValid);
    this.invalidChange.emit(!isValid);
    if (!isValid || parsed === row.amount) return;

    this.amountChange.emit({
      month: row.month,
      year: row.year,
      amount: parsed,
    });
  }

  /** Quitter le champ ferme l'édition et efface son éventuelle erreur locale. */
  protected closeEdit(): void {
    this.#clearError();
    this.editingKey.set(null);
  }

  #clearError(): void {
    this.hasEditError.set(false);
    this.invalidChange.emit(false);
  }
}
