import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  type SavingsGoalPaceStatus,
  type SavingsGoalStatus,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';
import { getDateDisplayFormats } from '@core/date/date-display-formats';
import { ROUTES } from '@core/routing';
import { UserSettingsStore } from '@core/user-settings';
import { BaseLoading } from '@ui/loading';
import { StateCard } from '@ui/state-card/state-card';
import { SavingsGoalStore } from '../services/savings-goals-store';
import { SavingsGoalsDialogService } from '../services/savings-goals-dialog.service';

type DetailViewState = 'loading' | 'error' | 'notFound' | 'ready';

@Component({
  selector: 'pulpe-savings-goal-detail-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    TranslocoPipe,
    AppCurrencyPipe,
    BaseLoading,
    StateCard,
  ],
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
            (action)="store.reloadProgress()"
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

          <mat-card appearance="outlined" class="w-full">
            <mat-card-content class="flex flex-col gap-6 p-6!">
              <!-- Header row: status + échéance + edit -->
              <div class="flex flex-wrap items-center gap-3">
                <mat-chip
                  class="!h-6 !text-label-small bg-surface-container"
                  data-testid="savings-goal-status-chip"
                >
                  {{ statusLabelKey(g.status) | transloco }}
                </mat-chip>
                <span
                  class="text-body-medium text-on-surface-variant"
                  data-testid="savings-goal-target-date"
                >
                  {{ 'savingsGoals.targetDate' | transloco }} :
                  {{ g.targetDate | date: shortDateFormat() }}
                </span>
                <button
                  matButton="outlined"
                  class="ml-auto"
                  (click)="onEdit()"
                  data-testid="edit-savings-goal-button"
                >
                  <mat-icon>edit</mat-icon>
                  {{ 'savingsGoals.detail.edit' | transloco }}
                </button>
              </div>

              @if (isEmpty()) {
                <pulpe-state-card
                  variant="empty"
                  [title]="'savingsGoals.detail.emptyTitle' | transloco"
                  [message]="'savingsGoals.detail.emptyMessage' | transloco"
                  testId="savings-goal-empty-lines"
                />
              } @else {
                <!-- Two-layer progress bar (Prévu behind, Pointé in front) -->
                <div class="flex flex-col gap-3">
                  <div class="flex items-end justify-between gap-2">
                    <span
                      class="text-headline-small font-bold text-financial-savings ph-no-capture"
                      data-testid="savings-goal-achievement"
                    >
                      {{
                        'savingsGoals.detail.achievement'
                          | transloco: { percent: p.achievementPercent }
                      }}
                    </span>
                    <span class="text-body-small text-on-surface-variant">
                      {{ 'savingsGoals.detail.target' | transloco }} :
                      <span class="ph-no-capture">{{
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
                    data-testid="savings-goal-progress-bar"
                  >
                    <div
                      class="absolute inset-y-0 left-0 rounded-full bg-financial-savings/35 motion-safe:transition-all motion-safe:duration-700"
                      [style.width.%]="plannedPercent()"
                      data-testid="progress-planned-layer"
                    ></div>
                    <div
                      class="absolute inset-y-0 left-0 rounded-full bg-financial-savings motion-safe:transition-all motion-safe:duration-700"
                      [style.width.%]="p.achievementPercent"
                      data-testid="progress-confirmed-layer"
                    ></div>
                  </div>

                  <div
                    class="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-small text-on-surface-variant"
                  >
                    <span class="flex items-center gap-1.5">
                      <span
                        class="inline-block size-2.5 rounded-full bg-financial-savings"
                      ></span>
                      {{ 'savingsGoals.detail.confirmed' | transloco }}
                    </span>
                    <span class="flex items-center gap-1.5">
                      <span
                        class="inline-block size-2.5 rounded-full bg-financial-savings/35"
                      ></span>
                      {{ 'savingsGoals.detail.plannedCumulative' | transloco }}
                    </span>
                  </div>
                </div>

                @if (paceChip(); as chip) {
                  <div
                    class="flex items-center gap-2 rounded-full px-3 py-1.5 w-fit text-label-large"
                    [class]="chip.classes"
                    data-testid="savings-goal-pace-chip"
                  >
                    <mat-icon class="text-base! size-4!" aria-hidden="true">{{
                      chip.icon
                    }}</mat-icon>
                    {{ chip.labelKey | transloco }}
                  </div>
                }

                <!-- Stats -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="flex flex-col gap-1" data-testid="stat-confirmed">
                    <span class="text-body-small text-on-surface-variant">
                      {{ 'savingsGoals.detail.confirmed' | transloco }}
                    </span>
                    <span
                      class="text-title-medium font-bold text-financial-savings ph-no-capture"
                    >
                      {{ p.confirmed | appCurrency: currency() : '1.0-0' }}
                    </span>
                  </div>
                  <div class="flex flex-col gap-1" data-testid="stat-planned">
                    <span class="text-body-small text-on-surface-variant">
                      {{ 'savingsGoals.detail.plannedCumulative' | transloco }}
                    </span>
                    <span class="text-title-medium font-medium ph-no-capture">
                      {{
                        p.plannedCumulative | appCurrency: currency() : '1.0-0'
                      }}
                    </span>
                  </div>
                  @if (p.required !== null) {
                    <div
                      class="flex flex-col gap-1"
                      data-testid="stat-required"
                    >
                      <span class="text-body-small text-on-surface-variant">
                        {{ 'savingsGoals.detail.required' | transloco }}
                      </span>
                      <span class="text-title-medium font-medium ph-no-capture">
                        {{
                          'savingsGoals.detail.requiredPerMonth'
                            | transloco
                              : {
                                  amount:
                                    p.required
                                    | appCurrency: currency() : '1.0-0',
                                }
                        }}
                      </span>
                    </div>
                  }
                  <div class="flex flex-col gap-1" data-testid="stat-projected">
                    <span class="text-body-small text-on-surface-variant">
                      {{ 'savingsGoals.detail.projected' | transloco }}
                    </span>
                    <span class="text-title-medium font-medium ph-no-capture">
                      {{ p.projected | appCurrency: currency() : '1.0-0' }}
                    </span>
                  </div>
                </div>

                <!-- D1 — deadline passed (stays ACTIVE, neutral, actionable) -->
                @if (p.isOverdue) {
                  <div
                    class="flex flex-col gap-2 rounded-2xl bg-surface-container p-4"
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
                @if (p.suggestCompletion) {
                  <div
                    class="flex flex-col gap-2 rounded-2xl bg-financial-savings/10 p-4"
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
                    class="flex flex-col gap-2 rounded-2xl bg-surface-container p-4"
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
              }
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SavingsGoalDetailPage {
  protected readonly store = inject(SavingsGoalStore);
  readonly #settings = inject(UserSettingsStore);
  readonly #dialogs = inject(SavingsGoalsDialogService);
  readonly #router = inject(Router);
  readonly #snackBar = inject(MatSnackBar);
  readonly #transloco = inject(TranslocoService);

  readonly id = input.required<string>();

  protected readonly goal = this.store.selectedGoal;
  protected readonly progress = this.store.progress;
  protected readonly currency = this.#settings.currency;
  protected readonly shortDateFormat = computed(
    () => getDateDisplayFormats(this.currency()).shortDate,
  );

  protected readonly viewState = computed<DetailViewState>(() => {
    if (this.store.progressError()) return 'error';
    if (
      this.store.isProgressLoading() ||
      this.store.savingsGoals.isInitialLoading()
    )
      return 'loading';
    if (this.goal() && this.progress()) return 'ready';
    return 'notFound';
  });

  protected readonly isEmpty = computed(
    () => this.progress()?.linkedLineCount === 0,
  );

  // Display-only bar width for the "Prévu" layer. The server owns every
  // business metric (achievementPercent is the authoritative confirmed value);
  // this ratio only positions the secondary visual layer.
  protected readonly plannedPercent = computed(() => {
    const p = this.progress();
    if (!p || p.targetAmount <= 0) return 0;
    return Math.min(
      Math.round((p.plannedCumulative / p.targetAmount) * 100),
      100,
    );
  });

  protected readonly paceChip = computed(() => {
    const status = this.progress()?.paceStatus ?? null;
    if (!status) return null;
    return PACE_CHIPS[status];
  });

  constructor() {
    effect(() => {
      this.store.setSelectedGoalId(this.id());
    });
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

  protected async onEdit(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    const result = await this.#dialogs.openEdit(goal);
    if (!result) return;
    try {
      if (this.#dialogs.isDeleteRequest(result)) {
        if (await this.#dialogs.confirmDelete()) {
          await this.store.removeGoal(goal.id);
          this.goBack();
        }
        return;
      }
      await this.store.editGoal(goal.id, result);
    } catch (error) {
      this.#showError(error);
    }
  }

  protected async onComplete(): Promise<void> {
    const goal = this.goal();
    if (!goal) return;
    try {
      await this.store.completeGoal(goal.id);
    } catch {
      this.#showStatusError();
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
