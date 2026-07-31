import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { debounceTime, firstValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  API_ERROR_CODES,
  compareBudgetPeriods,
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  type SavingsGoalDeletionCommand,
  type SavingsGoalFutureLine,
  type SavingsGoalPaceStatus,
  type SavingsGoalStatus,
  type SavingsGoalUpdate,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { isApiError } from '@core/api/api-error';
import { ApiErrorLocalizer } from '@core/api/api-error-localizer';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { ROUTES } from '@core/routing';
import { UserSettingsStore } from '@core/user-settings';
import { PageActionBar } from '@core/shell/page-action-bar';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { SavingsGoalStore } from '../services/savings-goals-store';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';
import {
  GoalDeletionDialog,
  type GoalDeletionDialogData,
} from './components/goal-deletion-dialog';
import { type GoalGenerationStopDecision } from './components/goal-generation-stop-dialog';
import { GoalPlanSimulatorStore } from './services/goal-plan-simulator-store';
import { GoalProjectionChart } from './components/goal-projection-chart';
import { GoalPlanTimeline } from './components/goal-plan-timeline';
import { GoalPlanSimulatorToolbar } from './components/goal-plan-simulator-toolbar';
import { GoalContributionsList } from './components/goal-contributions-list';
import { GoalPlanRepairCallout } from './components/goal-plan-repair-callout';

type DetailViewState = 'loading' | 'error' | 'notFound' | 'ready';

@Component({
  selector: 'pulpe-savings-goal-detail-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    AppCurrencyPipe,
    BaseLoading,
    StateCard,
    GoalProjectionChart,
    GoalPlanTimeline,
    GoalPlanSimulatorToolbar,
    GoalContributionsList,
    GoalPlanRepairCallout,
  ],
  providers: [GoalPlanSimulatorStore, AppCurrencyPipe],
  template: `
    <div
      class="flex flex-col gap-4 h-full min-w-0"
      data-testid="savings-goal-detail-page"
    >
      <header class="flex items-center gap-2 min-w-0">
        <button
          matIconButton
          (click)="goBack()"
          [attr.aria-label]="'savingsGoals.detail.back' | transloco"
          data-testid="savings-goal-back-button"
        >
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1
          class="text-headline-medium md:text-display-small truncate min-w-0 flex-shrink ph-no-capture"
          data-testid="page-title"
        >
          {{ goal()?.name }}
        </h1>
        @if (viewState() === 'ready' && !simulator.isSimulating()) {
          <div class="ml-auto flex items-center gap-1 shrink-0 md:hidden">
            <button
              matIconButton
              class="warn-theme"
              (click)="onDelete()"
              [attr.aria-label]="'savingsGoals.detail.delete' | transloco"
              data-testid="delete-savings-goal-button-mobile"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <div class="ml-auto hidden md:flex items-center gap-2 shrink-0">
            <button
              matButton="filled"
              class="warn-theme"
              (click)="onDelete()"
              [attr.aria-label]="'savingsGoals.detail.delete' | transloco"
              data-testid="delete-savings-goal-button"
            >
              <mat-icon>delete</mat-icon>
              {{ 'common.delete' | transloco }}
            </button>
          </div>
        }
      </header>

      @switch (viewState()) {
        @case ('loading') {
          <pulpe-base-loading
            [message]="'savingsGoals.detail.loading' | transloco"
            size="large"
            testId="savings-goal-detail-loading"
          />
        }
        @case ('error') {
          <pulpe-state-card
            variant="error"
            [title]="'common.error' | transloco"
            [message]="'savingsGoals.detail.loadError' | transloco"
            [actionLabel]="'common.retry' | transloco"
            (action)="reloadDetail()"
            testId="savings-goal-detail-error"
          />
        }
        @case ('notFound') {
          <pulpe-state-card
            variant="empty"
            [title]="'savingsGoals.detail.notFoundTitle' | transloco"
            [message]="'savingsGoals.detail.notFoundMessage' | transloco"
            [actionLabel]="'savingsGoals.detail.back' | transloco"
            (action)="goBack()"
            testId="savings-goal-detail-notfound"
          />
        }
        @default {
          @let g = goal()!;
          @let p = progress()!;

          <!-- Content sits flat on the page like the other detail screens
               (template-detail, budget-details) — no full-page card wrapper. -->
          <div class="flex flex-col gap-6">
            <!-- Header row: status + échéance + edit -->
            <div class="flex flex-wrap items-center gap-3">
              <mat-chip
                class="!h-6 !text-label-small bg-surface-container"
                data-testid="savings-goal-status-chip"
              >
                {{ statusLabelKey(g.status) | transloco }}
              </mat-chip>
              @if (g.startDate) {
                <span
                  class="text-body-medium text-on-surface-variant"
                  data-testid="savings-goal-start-date"
                >
                  {{ 'savingsGoals.startDate' | transloco }} :
                  {{ g.startDate | date: shortDateFormat() }}
                </span>
              }
              @if (g.targetDate) {
                <span
                  class="text-body-medium text-on-surface-variant"
                  data-testid="savings-goal-target-date"
                >
                  {{ 'savingsGoals.targetDate' | transloco }} :
                  {{ g.targetDate | date: shortDateFormat() }}
                </span>
              }
              @if (!simulator.isSimulating()) {
                <button
                  matButton="outlined"
                  class="ml-auto"
                  (click)="onEdit()"
                  data-testid="edit-savings-goal-button"
                >
                  <mat-icon>edit</mat-icon>
                  {{ 'savingsGoals.detail.edit' | transloco }}
                </button>
              }
            </div>

            @if (isEmpty()) {
              <!-- Flat empty state — no nested card inside the outlined card. -->
              <div
                class="flex flex-col items-center gap-3 py-10 text-center"
                data-testid="savings-goal-empty-lines"
              >
                <mat-icon class="text-5xl text-on-surface-variant"
                  >savings</mat-icon
                >
                <h2 class="text-title-large font-semibold">
                  {{ 'savingsGoals.detail.emptyTitle' | transloco }}
                </h2>
                <p class="text-body-large text-on-surface-variant max-w-md">
                  {{ 'savingsGoals.detail.emptyMessage' | transloco }}
                </p>
              </div>
            }
            @if (p.targetAmount !== null && p.achievementPercent !== null) {
              <!-- Two-layer progress bar (projection behind, reality in front) -->
              <div class="flex flex-col gap-3">
                <div class="flex items-end justify-between gap-2">
                  <span
                    class="text-headline-small font-bold text-financial-savings tabular-nums ph-no-capture"
                    data-testid="savings-goal-achievement"
                  >
                    {{
                      'savingsGoals.detail.achievement'
                        | transloco: { percent: p.achievementPercent }
                    }}
                  </span>
                  <span class="text-body-small text-on-surface-variant">
                    {{ 'savingsGoals.detail.target' | transloco }} :
                    <span class="ph-no-capture tabular-nums">{{
                      g.targetAmount | appCurrency: currency() : '1.2-2'
                    }}</span>
                  </span>
                </div>

                <div
                  class="relative w-full h-3 rounded-full bg-financial-savings/10 overflow-hidden"
                  role="progressbar"
                  [attr.aria-valuenow]="p.achievementPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="
                    'savingsGoals.detail.progressAriaLabel'
                      | transloco: { percent: p.achievementPercent }
                  "
                  [attr.aria-valuetext]="
                    'savingsGoals.detail.progressAriaValue'
                      | transloco
                        : {
                            confirmed: p.achievementPercent,
                            projected: projectedPercent(),
                          }
                  "
                  data-testid="savings-goal-progress-bar"
                >
                  <div
                    class="absolute inset-y-0 left-0 rounded-full bg-tertiary motion-safe:transition-[width] motion-safe:duration-700"
                    [style.width.%]="projectedPercent()"
                    data-testid="progress-projected-layer"
                  ></div>
                  <div
                    class="absolute inset-y-0 left-0 rounded-full bg-financial-savings motion-safe:transition-[width] motion-safe:duration-700"
                    [style.width.%]="p.achievementPercent"
                    data-testid="progress-confirmed-layer"
                  ></div>
                </div>
              </div>
            }

            @if (paceChip(); as chip) {
              <div
                class="flex items-center gap-1.5 rounded-full px-4 py-1.5 w-fit text-label-large"
                [class]="chip.classes"
                data-testid="savings-goal-pace-chip"
              >
                <mat-icon
                  class="text-base! w-auto! h-auto! leading-none"
                  aria-hidden="true"
                  >{{ chip.icon }}</mat-icon
                >
                {{ chip.labelKey | transloco }}
              </div>
            }

            <!-- Stats -->
            <div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
              @if (p.initialAmount > 0) {
                <div
                  class="flex flex-col gap-1"
                  data-testid="stat-initial-amount"
                >
                  <span class="text-body-small text-on-surface-variant">
                    {{ 'savingsGoals.detail.initialAmount' | transloco }}
                  </span>
                  <span
                    class="text-title-large font-semibold tabular-nums ph-no-capture"
                  >
                    {{ p.initialAmount | appCurrency: currency() : '1.0-0' }}
                  </span>
                </div>
              }
              <!-- The colored dots double as the legend of the two bar layers. -->
              <div class="flex flex-col gap-1" data-testid="stat-confirmed">
                <span
                  class="flex items-center gap-1.5 text-body-small text-on-surface-variant"
                >
                  <span
                    class="inline-block size-2.5 rounded-full bg-financial-savings"
                    aria-hidden="true"
                  ></span>
                  {{ 'savingsGoals.detail.confirmed' | transloco }}
                </span>
                <span
                  class="text-title-large font-bold text-financial-savings tabular-nums ph-no-capture"
                >
                  {{ p.confirmed | appCurrency: currency() : '1.0-0' }}
                </span>
              </div>
              <div class="flex flex-col gap-1" data-testid="stat-planned">
                <span
                  class="flex items-center gap-1.5 text-body-small text-on-surface-variant"
                >
                  <span
                    class="inline-block size-2.5 rounded-full bg-financial-savings/35"
                    aria-hidden="true"
                  ></span>
                  {{ 'savingsGoals.detail.plannedCumulative' | transloco }}
                </span>
                <span
                  class="text-title-large font-semibold tabular-nums ph-no-capture"
                >
                  {{ p.plannedCumulative | appCurrency: currency() : '1.0-0' }}
                </span>
              </div>
              <div
                class="flex flex-col gap-1"
                data-testid="stat-planned-projection"
              >
                <span
                  class="flex items-center gap-1.5 text-body-small text-on-surface-variant"
                >
                  @if (p.projected === null) {
                    <span
                      class="inline-block size-2.5 rounded-full bg-tertiary"
                      aria-hidden="true"
                      data-testid="stat-planned-projection-legend"
                    ></span>
                  }
                  {{ 'savingsGoals.detail.plannedProjection' | transloco }}
                </span>
                <span
                  class="text-title-large font-semibold tabular-nums ph-no-capture"
                >
                  {{ p.plannedProjection | appCurrency: currency() : '1.0-0' }}
                </span>
              </div>
              @if (p.required !== null) {
                <div class="flex flex-col gap-1" data-testid="stat-required">
                  <span class="text-body-small text-on-surface-variant">
                    {{ 'savingsGoals.detail.required' | transloco }}
                  </span>
                  <span
                    class="text-title-large font-semibold tabular-nums ph-no-capture"
                  >
                    {{
                      'savingsGoals.detail.requiredPerMonth'
                        | transloco
                          : {
                              amount:
                                p.required | appCurrency: currency() : '1.0-0',
                            }
                    }}
                  </span>
                </div>
              }
              @if (p.projected !== null) {
                <div class="flex flex-col gap-1" data-testid="stat-projected">
                  <span
                    class="flex items-center gap-1.5 text-body-small text-on-surface-variant"
                  >
                    <span
                      class="inline-block size-2.5 rounded-full bg-tertiary"
                      aria-hidden="true"
                    ></span>
                    {{ 'savingsGoals.detail.projected' | transloco }}
                  </span>
                  <span
                    class="text-title-large font-semibold tabular-nums ph-no-capture"
                  >
                    {{
                      displayedProjection() | appCurrency: currency() : '1.0-0'
                    }}
                  </span>
                </div>
              }
              @if (
                p.targetAmount !== null &&
                  p.targetDate === null &&
                  estimatedCompletionLabel();
                as period
              ) {
                <div
                  class="flex flex-col gap-1"
                  data-testid="stat-estimated-completion"
                >
                  <span class="text-body-small text-on-surface-variant">
                    {{ 'savingsGoals.detail.estimatedCompletion' | transloco }}
                  </span>
                  <span class="text-title-large font-semibold">
                    {{ period }}
                  </span>
                </div>
              }
            </div>

            <!-- D1 — deadline passed (stays ACTIVE, neutral, actionable) -->
            @if (
              p.targetDate !== null && p.isOverdue && g.status === 'ACTIVE'
            ) {
              <div
                class="mt-2 flex flex-col gap-2 rounded-2xl bg-surface-container p-4"
                data-testid="savings-goal-overdue-block"
              >
                <div
                  class="flex items-center gap-2 text-on-surface text-title-small font-medium"
                >
                  <mat-icon aria-hidden="true">event</mat-icon>
                  {{ 'savingsGoals.detail.overdueTitle' | transloco }}
                </div>
                <p class="text-body-medium text-on-surface-variant">
                  {{ 'savingsGoals.detail.overdueMessage' | transloco }}
                </p>
                <!-- Outlined : un seul bouton primaire par écran (DA §3.5) —
                         D1 et D2 peuvent coexister, le filled reste au CTA D2. -->
                <button
                  matButton="outlined"
                  class="w-fit"
                  (click)="onEdit()"
                  data-testid="savings-goal-postpone-button"
                >
                  <mat-icon>edit_calendar</mat-icon>
                  {{ 'savingsGoals.detail.postpone' | transloco }}
                </button>
              </div>
            }

            <!-- D2 — suggest completion (never auto-flipped) -->
            @if (
              p.targetAmount !== null &&
              p.suggestCompletion &&
              g.status === 'ACTIVE'
            ) {
              <div
                class="mt-2 flex flex-col gap-2 rounded-2xl bg-financial-savings/10 p-4"
                data-testid="savings-goal-suggest-completion"
              >
                <div
                  class="flex items-center gap-2 text-financial-savings text-title-small font-medium"
                >
                  <mat-icon aria-hidden="true">check_circle</mat-icon>
                  {{ 'savingsGoals.detail.suggestTitle' | transloco }}
                </div>
                <p class="text-body-medium text-on-surface-variant">
                  {{ 'savingsGoals.detail.suggestMessage' | transloco }}
                </p>
                <button
                  matButton="filled"
                  class="w-fit"
                  (click)="onComplete()"
                  data-testid="savings-goal-mark-completed-button"
                >
                  <mat-icon>flag</mat-icon>
                  {{ 'savingsGoals.detail.markCompleted' | transloco }}
                </button>
              </div>
            }

            <!-- COMPLETED — reversible -->
            @if (g.status === 'COMPLETED') {
              <div
                class="mt-2 flex flex-col gap-2 rounded-2xl bg-surface-container p-4"
                data-testid="savings-goal-completed-block"
              >
                <div
                  class="flex items-center gap-2 text-on-surface text-title-small font-medium"
                >
                  <mat-icon aria-hidden="true">emoji_events</mat-icon>
                  {{ 'savingsGoals.detail.completedTitle' | transloco }}
                </div>
                <p class="text-body-medium text-on-surface-variant">
                  {{ 'savingsGoals.detail.completedMessage' | transloco }}
                </p>
                <button
                  matButton="outlined"
                  class="w-fit"
                  (click)="onReopen()"
                  data-testid="savings-goal-reopen-button"
                >
                  <mat-icon>refresh</mat-icon>
                  {{ 'savingsGoals.detail.reopen' | transloco }}
                </button>
              </div>
            }

            <!-- PUL-285 CA8 — advisory: future linked lines of a stopped goal -->
            @if (g.status !== 'ACTIVE' && store.futureLines().length > 0) {
              <div
                class="mt-2 flex flex-col gap-2 rounded-2xl bg-surface-container p-4"
                data-testid="savings-goal-generation-stop-card"
              >
                <div
                  class="flex items-center gap-2 text-on-surface text-title-small font-medium"
                >
                  <mat-icon aria-hidden="true">event_upcoming</mat-icon>
                  {{ 'savingsGoals.generationStop.cardTitle' | transloco }}
                </div>
                <p class="text-body-medium text-on-surface-variant">
                  {{
                    'savingsGoals.generationStop.cardMessage'
                      | transloco: { count: store.futureLines().length }
                  }}
                </p>
                <button
                  matButton="outlined"
                  class="w-fit"
                  (click)="onManageFutureLines()"
                  data-testid="savings-goal-generation-stop-button"
                >
                  <mat-icon>tune</mat-icon>
                  {{ 'savingsGoals.generationStop.cardCta' | transloco }}
                </button>
              </div>
            }
          </div>

          @if (!isEmpty()) {
            <!-- Pilier A — « Ta trajectoire » (absent quand aucune ligne liée) -->
            @if (chartMonths().length > 0) {
              <section
                class="mt-4 flex flex-col gap-3"
                aria-labelledby="goal-trajectory-heading"
                data-testid="savings-goal-trajectory"
              >
                <h2
                  id="goal-trajectory-heading"
                  class="text-title-large font-semibold"
                >
                  {{ 'savingsGoals.plan.trajectoryTitle' | transloco }}
                </h2>
                <pulpe-goal-projection-chart
                  [months]="chartMonths()"
                  [draft]="simulator.draft()"
                  [targetAmount]="p.targetAmount"
                  [currency]="currency()"
                  [confirmed]="p.confirmed"
                  [projected]="displayedProjection()"
                />
              </section>
            }

            @if (simulator.isSimulating()) {
              <div
                class="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 text-body-small text-on-surface-variant"
                data-testid="goal-plan-sim-banner"
              >
                <mat-icon
                  class="text-base! w-auto! h-auto! leading-none"
                  aria-hidden="true"
                  >lock_open</mat-icon
                >
                {{ 'savingsGoals.simulate.banner' | transloco }}
              </div>
              <pulpe-goal-plan-simulator-toolbar
                [currency]="currency()"
                [verdict]="verdict()"
                [ariaVerdict]="ariaVerdict()"
                [targetReached]="targetReached()"
              />
            }

            <!-- Pilier B — « Ton plan, mois par mois » -->
            <section
              class="mt-4 flex flex-col gap-3"
              aria-labelledby="goal-plan-heading"
              data-testid="savings-goal-plan"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="goal-plan-heading"
                  class="text-title-large font-semibold"
                >
                  {{ 'savingsGoals.plan.timelineTitle' | transloco }}
                </h2>
                @if (!simulator.isSimulating() && simulator.canSimulate()) {
                  <button
                    matButton="outlined"
                    (click)="onEnterSimulation()"
                    data-testid="goal-plan-adjust-button"
                  >
                    <mat-icon>tune</mat-icon>
                    {{ 'savingsGoals.plan.adjustCta' | transloco }}
                  </button>
                }
              </div>
              @if (!simulator.isSimulating()) {
                <pulpe-goal-plan-repair-callout
                  [count]="repairableMonths().length"
                  [isApplying]="isApplying()"
                  (previewRequested)="onPreviewPlanRepair()"
                />
              }
              <pulpe-goal-plan-timeline
                [months]="chartMonths()"
                [simulatedMonths]="
                  simulator.isSimulating() ? simulator.draftRows() : null
                "
                [currency]="currency()"
                [locale]="locale"
                [payDayOfMonth]="payDayOfMonth()"
                [editable]="simulator.isSimulating()"
                [expanded]="timelineExpanded()"
                (amountChange)="onTimelineAmountChange($event)"
                (toggleExpanded)="toggleTimeline()"
              />
            </section>

            <!-- « Ton suivi » — masqué en simulation (loi de Hick) -->
            @if (!simulator.isSimulating()) {
              <section
                class="mt-4 flex flex-col gap-3"
                aria-labelledby="goal-contributions-heading"
                data-testid="savings-goal-contributions"
              >
                <h2
                  id="goal-contributions-heading"
                  class="text-title-large font-semibold"
                >
                  {{ 'savingsGoals.detail.contributionsTitle' | transloco }}
                </h2>
                <pulpe-goal-contributions-list
                  [contributions]="store.contributions()"
                  [currency]="currency()"
                />
              </section>
            }
          }
        }
      }

      <!-- Plan action bar. Declared as a template and projected into the app
           shell's bottom slot (PageActionBar service) while simulating — the
           shell owns positioning (full-bleed, pinned like the top toolbar), so
           this page carries only the bar's content: no absolute/fixed/spacer. -->
      <ng-template #planActionBar>
        <div
          class="flex items-center justify-end gap-2 bg-surface py-3 pl-6 pr-14 shadow-[0_-3px_3px_-2px_rgba(0,0,0,0.2),0_-3px_4px_0_rgba(0,0,0,0.14),0_-1px_8px_0_rgba(0,0,0,0.12)]"
          data-testid="goal-plan-sticky-bar"
        >
          <button
            matButton
            (click)="onCancelSimulation()"
            [disabled]="isApplying()"
            data-testid="goal-plan-cancel"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            matButton="filled"
            (click)="onApplyPlan()"
            [disabled]="!simulator.hasChanges() || isApplying()"
            data-testid="goal-plan-apply"
          >
            <span class="flex items-center justify-center">
              @if (isApplying()) {
                <mat-spinner diameter="20" class="mr-2" />
              }
              {{
                'savingsGoals.simulate.applyCta'
                  | transloco: { count: simulator.dirtyCount() }
              }}
            </span>
          </button>
        </div>
      </ng-template>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SavingsGoalDetailPage {
  protected readonly store = inject(SavingsGoalStore);
  protected readonly simulator = inject(GoalPlanSimulatorStore);
  readonly #settings = inject(UserSettingsStore);
  readonly #dialogs = inject(SavingsGoalsDialogService);
  readonly #dialog = inject(MatDialog);
  readonly #injector = inject(Injector);
  readonly #router = inject(Router);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);
  readonly #currencyPipe = inject(AppCurrencyPipe);
  readonly #errorLocalizer = inject(ApiErrorLocalizer);
  protected readonly locale = inject(LOCALE_ID);
  readonly #pageActionBar = inject(PageActionBar);

  /** The plan action bar (`<ng-template #planActionBar>`), projected into the
   *  app-shell's bottom slot while simulating (see constructor). Must be TS
   *  `private`, not ES `#` — Angular signal queries reject `#` (NG1053). */
  private readonly planActionBarTemplate =
    viewChild<TemplateRef<unknown>>('planActionBar');

  readonly id = input.required<string>();

  protected readonly goal = this.store.selectedGoal;
  protected readonly progress = this.store.progress;
  protected readonly currency = this.#settings.currency;
  protected readonly payDayOfMonth = this.#settings.payDayOfMonth;
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected readonly chartMonths = computed(
    () => this.progress()?.months ?? [],
  );
  protected readonly repairAmount = computed(
    () => Math.ceil((this.progress()?.required ?? 0) * 100) / 100,
  );
  protected readonly repairableMonths = computed(() => {
    const progress = this.progress();
    if (!progress || progress.status !== 'ACTIVE' || this.repairAmount() <= 0) {
      return [];
    }
    return progress.months.filter(
      (month) =>
        month.hasBudget === true &&
        month.isProvisionable === true &&
        !month.isLocked &&
        month.isContributionEligible !== false,
    );
  });
  protected readonly estimatedCompletionLabel = computed(() => {
    const period = this.progress()?.estimatedCompletion;
    return period ? this.#formatMonthYear(period.month, period.year) : null;
  });

  readonly #timelineExpanded = signal(false);
  protected readonly timelineExpanded = computed(
    () => this.#timelineExpanded() || this.simulator.isSimulating(),
  );

  readonly #isApplying = signal(false);
  protected readonly isApplying = this.#isApplying.asReadonly();

  // Live verdict (updates < 16 ms on every gesture); the aria-live echo is
  // debounced ~500 ms so a screen reader is not spammed during a drag.
  protected readonly verdict = computed(() => {
    const draft = this.simulator.draft();
    if (!draft || draft.isTargetMet === null) return '';
    const attained = draft.attainedPeriod;
    if (!attained) {
      return this.#transloco.translate(
        'savingsGoals.simulate.verdictUnreached',
      );
    }
    return this.#transloco.translate('savingsGoals.simulate.verdict', {
      period: this.#formatMonthYear(attained.month, attained.year),
    });
  });

  // Drives the verdict icon only (check vs flag); the color stays savings-green
  // regardless of state (RG-002 — savings is never an alert).
  protected readonly targetReached = computed(
    () => !!this.simulator.draft()?.attainedPeriod,
  );

  protected readonly ariaVerdict = toSignal(
    toObservable(this.verdict).pipe(debounceTime(500)),
    { initialValue: '' },
  );

  protected readonly viewState = computed<DetailViewState>(() => {
    if (this.store.progressError() || this.store.savingsGoals.error())
      return 'error';
    if (
      this.store.isProgressLoading() ||
      this.store.savingsGoals.isInitialLoading() ||
      this.store.isContributionsLoading()
    )
      return 'loading';
    if (this.goal() && this.progress()) return 'ready';
    return 'notFound';
  });

  protected readonly isEmpty = computed(
    () => this.progress()?.linkedLineCount === 0,
  );

  protected readonly displayedProjection = computed(
    () =>
      this.simulator.draft()?.simulatedFinal ??
      this.progress()?.projected ??
      this.progress()?.plannedProjection ??
      0,
  );

  // Display-only bar width for the planned projection layer. The server owns
  // the read-mode endpoint; the sandbox owns it while simulation is active.
  protected readonly projectedPercent = computed(() => {
    const p = this.progress();
    if (!p || p.targetAmount == null || p.targetAmount <= 0) return 0;
    return Math.min(
      Math.round((this.displayedProjection() / p.targetAmount) * 100),
      100,
    );
  });

  protected readonly paceChip = computed(() => {
    const status = this.progress()?.paceStatus ?? null;
    if (!status) return null;
    return PACE_CHIPS[status];
  });

  constructor() {
    // Route id → store selection is an imperative store sync, not derived
    // state — a signal-setting effect() is banned (angular-signals.md).
    toObservable(this.id)
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.store.setSelectedGoalId(id));

    // Project the plan action bar into the app-shell's bottom slot while
    // simulating (same imperative-sync pattern, not an effect). Cleared on
    // teardown so it never lingers on the next page.
    toObservable(this.simulator.isSimulating)
      .pipe(takeUntilDestroyed())
      .subscribe((simulating) =>
        this.#pageActionBar.template.set(
          simulating ? (this.planActionBarTemplate() ?? null) : null,
        ),
      );
    inject(DestroyRef).onDestroy(() => this.#pageActionBar.clear());
  }

  protected statusLabelKey(status: SavingsGoalStatus): string {
    switch (status) {
      case 'COMPLETED':
        return 'savingsGoals.statusCompleted';
      case 'PAUSED':
        return 'savingsGoals.statusPaused';
      default:
        return 'savingsGoals.statusActive';
    }
  }

  goBack(): void {
    this.#router.navigate(['/', ROUTES.SAVINGS_GOALS]);
  }

  protected reloadDetail(): void {
    this.store.refresh();
    this.store.reloadProgress();
  }

  protected async onEdit(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    const result = await this.#dialogs.openEdit(goal);
    if (!result) return;
    const deadlineWasAdvanced = this.#movesDeadlineEarlier(
      goal.targetDate,
      result,
    );
    if (deadlineWasAdvanced && result.targetDate) {
      const applied = await this.#editAdvancedDeadline(
        goal.id,
        result,
        result.targetDate,
      );
      if (!applied) return;
    } else {
      try {
        await this.store.editGoal(goal.id, result);
      } catch (error) {
        this.#showError(error);
        return;
      }
    }
    // Advisory sur les vraies TRANSITIONS seulement — renommer un objectif
    // déjà en pause ne doit pas rouvrir le dialog (la carte reste la porte
    // de ré-entrée).
    if (
      (result.status === 'PAUSED' || result.status === 'COMPLETED') &&
      result.status !== goal.status
    ) {
      await this.#proposeGenerationStop(goal.id, result.status);
    }
  }

  async #editAdvancedDeadline(
    goalId: string,
    updates: SavingsGoalUpdate,
    targetDate: string,
  ): Promise<boolean> {
    let lines: SavingsGoalFutureLine[];
    try {
      lines = await this.store.fetchFutureLines(goalId, targetDate);
    } catch (error) {
      this.#showLocalizedApiError(error);
      return false;
    }

    while (true) {
      let patch = updates;
      if (lines.length > 0) {
        const decision = await this.#dialogs.openGenerationStop({
          lines,
          context: { kind: 'deadline', targetDate },
          currency: this.currency(),
          locale: this.locale,
          payDayOfMonth: this.payDayOfMonth(),
        });
        if (!decision) return false;
        patch = {
          ...updates,
          reconciliation: {
            mode: decision,
            budgetLineIds: lines.map((line) => line.budgetLineId),
          },
        };
      }

      try {
        await this.store.editGoal(goalId, patch);
        return true;
      } catch (error) {
        const retryable =
          isApiError(error) &&
          (error.code ===
            API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_CONFLICT ||
            error.code ===
              API_ERROR_CODES.SAVINGS_GOAL_RECONCILIATION_REQUIRED);
        if (isApiError(error) && (patch.reconciliation || retryable)) {
          this.#showLocalizedApiError(error);
        } else {
          this.#showError(error);
        }
        if (!retryable) return false;

        try {
          lines = await this.store.fetchFutureLines(goalId, targetDate);
        } catch (previewError) {
          this.#showLocalizedApiError(previewError);
          return false;
        }
        // The server no longer asks for a decision. Never reinterpret that as
        // consent to retry the deadline PATCH without reconciliation.
        if (lines.length === 0) return false;
      }
    }
  }

  protected async onDelete(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    const dialogRef = this.#dialog.open<
      GoalDeletionDialog,
      GoalDeletionDialogData,
      SavingsGoalDeletionCommand
    >(GoalDeletionDialog, {
      data: {
        goalId: goal.id,
        goalName: goal.name,
        currency: this.currency(),
        locale: this.locale,
        payDayOfMonth: this.payDayOfMonth(),
      },
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90dvh',
      injector: this.#injector,
    });
    const command = await firstValueFrom(dialogRef.afterClosed());
    if (!command) return;
    try {
      await this.store.deleteGoal(goal.id, command);
      this.goBack();
    } catch (error) {
      this.#showLocalizedApiError(error);
      if (
        isApiError(error) &&
        error.code ===
          API_ERROR_CODES.SAVINGS_GOAL_DELETION_RECALCULATION_FAILED
      ) {
        this.goBack();
      }
    }
  }

  protected async onComplete(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    try {
      await this.store.completeGoal(goal.id);
    } catch {
      this.#showStatusError();
      return;
    }
    await this.#proposeGenerationStop(goal.id, 'COMPLETED');
  }

  protected async onManageFutureLines(): Promise<void> {
    const goal = this.goal();
    if (!goal || goal.status === 'ACTIVE') return;
    await this.#proposeGenerationStop(goal.id, goal.status);
  }

  /**
   * PUL-285 CA8 — advisory après l'arrêt d'un objectif : liste les prévisions
   * liées futures et applique la décision explicite (figer ou retirer).
   * Aucune écriture sans accord ; fermer le dialog ne change rien (la carte
   * dérivée de l'état serveur reste comme porte de ré-entrée).
   */
  async #proposeGenerationStop(
    goalId: string,
    status: SavingsGoalStatus,
  ): Promise<void> {
    let lines: SavingsGoalFutureLine[];
    try {
      lines = await this.store.fetchFutureLines(goalId);
    } catch (error) {
      this.#showLocalizedApiError(error);
      return;
    }
    if (lines.length === 0) return;

    const decision = await this.#dialogs.openGenerationStop({
      lines,
      context: { kind: 'status', status },
      currency: this.currency(),
      locale: this.locale,
      payDayOfMonth: this.payDayOfMonth(),
    });
    if (!decision) return;
    await this.#applyGenerationStopDecision(goalId, decision, lines);
  }

  async #applyGenerationStopDecision(
    goalId: string,
    decision: GoalGenerationStopDecision,
    lines: SavingsGoalFutureLine[],
  ): Promise<void> {
    try {
      const { affectedCount } = await this.store.applyGenerationStop(goalId, {
        mode: decision,
        budgetLineIds: lines.map((line) => line.budgetLineId),
      });
      this.#snackBar.open(
        this.#transloco.translate(
          decision === 'freeze'
            ? 'savingsGoals.generationStop.successFreeze'
            : 'savingsGoals.generationStop.successRemove',
          { count: affectedCount },
        ),
        this.#transloco.translate('common.close'),
        { duration: 5000 },
      );
    } catch (error) {
      this.#showLocalizedApiError(error);
    }
  }

  protected async onReopen(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    try {
      await this.store.reopenGoal(goal.id);
    } catch {
      this.#showStatusError();
    }
  }

  #movesDeadlineEarlier(
    currentTargetDate: string | null,
    update: SavingsGoalUpdate,
  ): boolean {
    if (!currentTargetDate || !update.targetDate) return false;
    const payDay = this.payDayOfMonth();
    const currentPeriod = getBudgetPeriodForDate(
      parseIsoDateLocal(currentTargetDate),
      payDay,
    );
    const nextPeriod = getBudgetPeriodForDate(
      parseIsoDateLocal(update.targetDate),
      payDay,
    );
    return compareBudgetPeriods(nextPeriod, currentPeriod) < 0;
  }

  // ── Simulation (pilier C) ──
  protected onEnterSimulation(): void {
    this.simulator.enter();
  }

  protected onTimelineAmountChange(change: {
    month: number;
    year: number;
    amount: number;
  }): void {
    this.simulator.setMonth(change.month, change.year, change.amount);
  }

  protected toggleTimeline(): void {
    this.#timelineExpanded.update((expanded) => !expanded);
  }

  protected async onCancelSimulation(): Promise<void> {
    if (this.simulator.hasChanges()) {
      const discard = await this.#dialogs.confirmDiscardChanges();
      if (!discard) return;
    }
    this.simulator.exit();
    this.#timelineExpanded.set(false);
  }

  protected async onApplyPlan(): Promise<void> {
    const draft = this.simulator.draft();
    if (!draft) return;
    const changes = draft.months
      .filter((month) => month.isAdjusted)
      .map((month) => ({
        month: month.month,
        year: month.year,
        before: month.plannedAmount,
        after: month.simulatedAmount,
      }));
    if (changes.length === 0) return;

    const confirmed = await this.#dialogs.openApplyPlan({
      changes,
      currency: this.currency(),
      locale: this.locale,
      payDayOfMonth: this.payDayOfMonth(),
      verdict: this.verdict(),
    });
    if (!confirmed) return;

    this.#isApplying.set(true);
    try {
      await this.simulator.apply();
      this.#timelineExpanded.set(false);
      this.#openSnackBar(
        this.#transloco.translate('savingsGoals.simulate.applySuccess'),
      );
    } catch (error) {
      this.#showLocalizedApiError(error);
    } finally {
      this.#isApplying.set(false);
    }
  }

  protected async onPreviewPlanRepair(): Promise<void> {
    const goal = this.goal();
    const progress = this.progress();
    const months = this.repairableMonths();
    if (!goal || !progress || months.length === 0) return;

    const amount = this.repairAmount();
    const changes = months.map((month) => ({
      month: month.month,
      year: month.year,
      before: 0,
      after: amount,
    }));
    const projected = progress.plannedProjection + amount * changes.length;
    const confirmed = await this.#dialogs.openApplyPlan({
      mode: 'creation',
      changes,
      currency: this.currency(),
      locale: this.locale,
      payDayOfMonth: this.payDayOfMonth(),
      verdict: this.#transloco.translate('savingsGoals.plan.repairProjection', {
        amount: this.#currencyPipe.transform(
          projected,
          this.currency(),
          '1.0-0',
        ),
      }),
      verdictHasAmount: true,
    });
    if (!confirmed) return;

    this.#isApplying.set(true);
    try {
      await this.store.applyPlan(goal.id, {
        monthAdjustments: [],
        missingMonthAdjustments: changes.map((change) => ({
          month: change.month,
          year: change.year,
          amount: change.after,
        })),
      });
      this.#openSnackBar(
        this.#transloco.translate('savingsGoals.simulate.applySuccess'),
      );
    } catch (error) {
      this.#showLocalizedApiError(error);
    } finally {
      this.#isApplying.set(false);
    }
  }

  #formatMonthYear(month: number, year: number): string {
    return new Intl.DateTimeFormat(this.locale, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));
  }

  #showLocalizedApiError(error: unknown): void {
    // Domain error codes are localized centrally in ApiErrorLocalizer.
    const message = isApiError(error)
      ? this.#errorLocalizer.localizeApiError(error)
      : this.#transloco.translate('common.error');
    this.#openSnackBar(message);
  }

  #showStatusError(): void {
    this.#openSnackBar(
      this.#transloco.translate('savingsGoals.detail.statusChangeError'),
    );
  }

  #showError(error: unknown): void {
    const message =
      error instanceof Error
        ? error.message
        : this.#transloco.translate('common.error');
    this.#openSnackBar(message);
  }

  #openSnackBar(message: string): void {
    this.#snackBar.open(message, this.#transloco.translate('common.close'), {
      duration: 5000,
      panelClass: ['bg-error-container', 'text-on-error-container'],
    });
  }
}

// Pace chips stay neutral/primary — épargne is a goal to reach, never a risk to
// flag (RG-002 / docs/SAVINGS.md §7). No amber, no red anywhere on this page.
const PACE_CHIPS: Record<
  SavingsGoalPaceStatus,
  { labelKey: string; icon: string; classes: string }
> = {
  behind: {
    labelKey: 'savingsGoals.detail.paceBehind',
    icon: 'trending_flat',
    classes: 'bg-surface-container text-on-surface-variant',
  },
  on_track: {
    labelKey: 'savingsGoals.detail.paceOnTrack',
    icon: 'trending_up',
    classes: 'bg-financial-savings/10 text-financial-savings',
  },
  ahead: {
    labelKey: 'savingsGoals.detail.paceAhead',
    icon: 'rocket_launch',
    classes: 'bg-financial-savings/10 text-financial-savings',
  },
};
