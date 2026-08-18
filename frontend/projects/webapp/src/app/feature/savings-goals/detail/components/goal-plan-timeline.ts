import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { formatNumber } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  formatBudgetPeriod,
  isContributivePlanMonth,
  type SavingsGoalPlanMonth,
  type SavingsGoalPlannedWithdrawal,
  type SavingsPlanSimulatedMonth,
  type SupportedCurrency,
} from 'pulpe-shared';
import { AppCurrencyPipe } from '@core/currency';

interface GoalPlanTimelineRow {
  periodKey: number;
  month: number;
  year: number;
  isLocked: boolean;
  isCurrent: boolean;
  isChecked: boolean;
  isGap: boolean;
  hasLinkedForecast: boolean;
  hasBudget: boolean;
  isRepairable: boolean;
  isOpen: boolean;
  blockedByRealization: boolean;
  withdrawalBudgetId: string | null;
  isAdjusted: boolean;
  amount: number;
  cumulative: number;
  /**
   * Ce mois n'est là QUE pour son retrait : fermé aux contributions, il ne
   * porterait aucune ligne à afficher, mais c'est lui qui explique la chute du
   * cumul. Montant toujours positif — la sortie de stock est signée à l'écran.
   */
  isWithdrawalOnly: boolean;
  withdrawn: number;
  /**
   * Ce que le mois ANNONCE sortir (PUL-329 v2). Somme brute, affichage seul :
   * la part déjà réalisée vit dans le confirmé et le reliquat est ce que la
   * projection retranche — la sous-ligne, elle, dit seulement « ce mois prévoit
   * de sortir 500 ». Non éditable : le simulateur n'ajuste que les contributions.
   */
  plannedWithdrawal: number;
}

interface GoalPlanTimelineVisibleRow extends GoalPlanTimelineRow {
  /** First visible row of its year — renders a year divider above the row. */
  showYear: boolean;
}

const WINDOW_OPEN_ROWS = 3;

/**
 * « Ton plan, mois par mois » (docs/SAVINGS.md §10.1). Vertical
 * list reusing the spread-occurrences grammar (savings only, RG-002). Read mode
 * shows the planned amounts; when `simulatedMonths` is provided the rows follow
 * the sandbox. Windowed by default (last locked row + 3 open rows) with a « Voir
 * tout le plan » disclosure; auto-expanded by the parent while simulating.
 */
@Component({
  selector: 'pulpe-goal-plan-timeline',
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
    AppCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2" data-testid="goal-plan-timeline">
      @for (row of visibleRows(); track row.periodKey) {
        @if (row.showYear) {
          <div
            class="px-1 pt-3 first:pt-0 text-label-large font-semibold tabular-nums text-on-surface-variant"
            data-testid="goal-plan-year"
          >
            {{ row.year }}
          </div>
        }
        <div
          class="flex items-center gap-3 rounded-xl bg-surface-container-low p-4"
          [class.opacity-60]="row.isLocked && !row.blockedByRealization"
          [attr.data-testid]="'goal-plan-row-' + row.periodKey"
          [attr.data-current]="row.isCurrent"
          [attr.data-locked]="row.isLocked"
        >
          <mat-icon
            class="shrink-0"
            [class.text-financial-savings]="row.isChecked"
            [class.icon-filled]="row.isChecked"
            [class.text-on-surface-variant]="!row.isChecked && row.isLocked"
            [class.invisible]="!row.isChecked && !row.isLocked"
            aria-hidden="true"
          >
            {{ row.isChecked ? 'check_circle' : 'lock' }}
          </mat-icon>

          <div class="flex min-w-0 flex-1 flex-col">
            <span class="flex flex-wrap items-center gap-2">
              <span class="text-body-medium font-medium">
                {{ formatPeriod(row.month, row.year) }}
              </span>
              @if (row.isCurrent) {
                <span
                  class="text-label-small font-medium rounded-full px-2 py-0.5
                         bg-primary-container text-on-primary-container shrink-0"
                  data-testid="goal-plan-current-badge"
                >
                  {{ 'savingsGoals.plan.currentMonth' | transloco }}
                </span>
              }
              @if (row.isWithdrawalOnly) {
                <span
                  class="text-label-small font-medium rounded-full px-2 py-0.5
                         bg-surface-container-high text-on-surface-variant shrink-0"
                  data-testid="goal-plan-withdrawal-chip"
                >
                  {{ 'savingsGoals.plan.withdrawnSoFar' | transloco }}
                </span>
              } @else if (!row.hasLinkedForecast) {
                <span
                  class="text-label-small font-medium rounded-full px-2 py-0.5
                         bg-surface-container-high text-on-surface-variant shrink-0"
                  [attr.data-testid]="
                    row.isRepairable
                      ? 'goal-plan-repair-chip'
                      : row.hasBudget
                        ? 'goal-plan-no-forecast-chip'
                        : 'goal-plan-gap-chip'
                  "
                >
                  {{
                    (row.isRepairable
                      ? 'savingsGoals.plan.repairChip'
                      : row.hasBudget
                        ? 'savingsGoals.plan.noForecastChip'
                        : 'savingsGoals.plan.gapChip'
                    ) | transloco
                  }}
                </span>
              }
            </span>
            <span
              class="ph-no-capture text-body-small text-on-surface-variant tabular-nums"
            >
              &rarr; {{ row.cumulative | appCurrency: currency() : '1.0-0' }}
            </span>
            @if (row.plannedWithdrawal > 0) {
              <span
                class="ph-no-capture text-body-small text-on-surface-variant tabular-nums"
                data-testid="goal-plan-row-planned-withdrawal"
              >
                {{ 'savingsGoals.plan.plannedWithdrawal' | transloco }} ·
                {{ -row.plannedWithdrawal | appCurrency: currency() : '1.0-2' }}
              </span>
            }
            @if (row.blockedByRealization) {
              <span
                class="text-body-small text-on-surface-variant"
                data-testid="goal-plan-row-realized-lock"
              >
                {{ 'savingsGoals.plan.realizedWithdrawalLock' | transloco }}
              </span>
              @if (row.withdrawalBudgetId) {
                <a
                  matButton
                  class="mt-1 w-fit"
                  [routerLink]="['/budget', row.withdrawalBudgetId]"
                  data-testid="goal-plan-row-open-budget"
                >
                  {{
                    'savingsGoals.plan.openWithdrawalBudget'
                      | transloco: { period: formatPeriod(row.month, row.year) }
                  }}
                  <mat-icon>arrow_forward</mat-icon>
                </a>
              }
            }
          </div>

          @if (row.isWithdrawalOnly) {
            <span
              class="ph-no-capture shrink-0 text-body-medium font-semibold
                     tabular-nums text-on-surface-variant"
              data-testid="goal-plan-row-withdrawn"
            >
              {{ -row.withdrawn | appCurrency: currency() : '1.0-2' }}
            </span>
          } @else if (
            editable() && row.isOpen && editingKey() === row.periodKey
          ) {
            <div class="flex shrink-0 flex-col items-end gap-1">
              <input
                type="number"
                inputmode="decimal"
                step="0.01"
                class="ph-no-capture w-28 rounded-lg border bg-surface px-3 py-1.5
                       text-right text-body-medium"
                [class.border-outline]="!hasEditError()"
                [class.border-error]="hasEditError()"
                [attr.aria-label]="'savingsGoals.plan.editAmount' | transloco"
                [attr.aria-invalid]="hasEditError()"
                [attr.aria-describedby]="
                  hasEditError() ? 'goal-plan-row-error' : null
                "
                [attr.value]="row.amount"
                (input)="onAmountInput(row, $event)"
                (blur)="closeEdit()"
                (keydown.enter)="closeEdit()"
                #amountField
                data-testid="goal-plan-row-input"
              />
              <p class="text-right text-body-small text-on-surface-variant">
                {{ 'savingsGoals.plan.movementHint' | transloco }}
              </p>
              @if (hasEditError()) {
                <p
                  id="goal-plan-row-error"
                  role="alert"
                  class="max-w-56 text-right text-body-small text-error"
                  data-testid="goal-plan-row-error"
                >
                  {{ 'savingsGoals.plan.editAmountInvalid' | transloco }}
                </p>
              }
            </div>
          } @else if (editable() && row.isOpen) {
            <button
              matButton
              class="shrink-0"
              (click)="startEdit(row.periodKey)"
              [attr.data-testid]="'goal-plan-row-edit-' + row.periodKey"
            >
              <span
                class="ph-no-capture text-body-medium font-semibold tabular-nums"
                [class.text-financial-savings]="row.isAdjusted"
              >
                {{ row.amount | appCurrency: currency() : '1.0-2' }}
              </span>
              <mat-icon class="text-base! w-auto! h-auto! leading-none ml-1"
                >edit</mat-icon
              >
            </button>
          } @else {
            <span
              class="ph-no-capture shrink-0 text-body-medium font-semibold tabular-nums"
              [class.text-financial-savings]="row.isAdjusted"
              [attr.aria-label]="lockedAmountLabel(row)"
            >
              {{ row.amount | appCurrency: currency() : '1.0-2' }}
            </span>
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
              'savingsGoals.plan.seeAll' | transloco: { count: rows().length }
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
export class GoalPlanTimeline {
  readonly #transloco = inject(TranslocoService);

  readonly months = input.required<readonly SavingsGoalPlanMonth[]>();
  readonly simulatedMonths = input<readonly SavingsPlanSimulatedMonth[] | null>(
    null,
  );
  readonly currency = input.required<SupportedCurrency>();
  readonly locale = input.required<string>();
  readonly payDayOfMonth = input<number | null>(null);
  readonly editable = input<boolean>(false);
  readonly expanded = input<boolean>(false);
  readonly canRepair = input<boolean>(false);
  readonly plannedWithdrawals = input<readonly SavingsGoalPlannedWithdrawal[]>(
    [],
  );

  readonly amountChange = output<{
    month: number;
    year: number;
    amount: number;
  }>();
  /** La saisie en cours est refusée : le parent referme « Appliquer ». */
  readonly invalidChange = output<boolean>();
  readonly toggleExpanded = output<void>();

  protected readonly editingKey = signal<number | null>(null);
  protected readonly hasEditError = signal(false);

  // Focus the inline field when it appears (user opened it) — a11y-friendly
  // alternative to the banned `autofocus` attribute.
  private readonly amountField =
    viewChild<ElementRef<HTMLInputElement>>('amountField');

  constructor() {
    effect(() => this.amountField()?.nativeElement.focus());
  }

  protected readonly rows = computed<GoalPlanTimelineRow[]>(() => {
    const canRepair = this.canRepair();
    const simulated = this.simulatedMonths();
    // Un retrait tombe où l'utilisateur a pioché, y compris après l'échéance,
    // là où le mois est fermé aux contributions. Le calculateur creuse le cumul
    // de ce retrait quel que soit le mois (savings-goal-plan.ts) : écarter la
    // ligne laisserait le cumul chuter entre deux lignes sans rien pour le dire.
    const source = (simulated ?? this.months()).filter(
      (month) =>
        month.isContributionEligible !== false ||
        (month.withdrawnAmount ?? 0) > 0,
    );
    return source.map((month) => {
      const planLinkedWithdrawal = this.plannedWithdrawals().find(
        (withdrawal) =>
          withdrawal.origin === 'plan_linked' &&
          withdrawal.month === month.month &&
          withdrawal.year === month.year,
      );
      const isChecked =
        month.lines.length > 0 &&
        month.lines.every((line) => line.checkedAt != null);
      const blockedByRealization =
        (month.planWithdrawalConsumedAmount ?? 0) > 0 &&
        !isContributivePlanMonth(month);
      const isOpen = isContributivePlanMonth(month);
      const sim = month as SavingsPlanSimulatedMonth;
      return {
        periodKey: month.year * 12 + month.month,
        month: month.month,
        year: month.year,
        isLocked: month.isLocked || blockedByRealization,
        isCurrent: month.state === 'current',
        isChecked,
        isGap: month.state === 'gap',
        hasLinkedForecast: month.lines.length > 0,
        hasBudget: month.hasBudget === true,
        // The month-level half mirrors the page's repairableMonths() and
        // iOS's SavingsGoalPlanMonth.isRepairable exactly: 2 terms, not 4.
        // The calculator (buildSavingsGoalTimeline, in pulpe-shared)
        // sets isProvisionable only when !hasLines, !isLocked AND
        // isContributionEligible already hold — re-testing them here would
        // duplicate a guarantee the producer already gives every consumer.
        // hasBudget is NOT implied (isProvisionable's `||` alternative lets
        // canProvisionMissingPeriods substitute for it), so it stays explicit.
        // canRepair carries the half a month cannot know: repair is a
        // plan-level offer, gated on an ACTIVE goal with a required amount
        // above zero. A goal whose initial amount already covers its target
        // floors required at 0 (savings-goal-progress.ts:301) while its empty
        // future months stay provisionable — without this term the chip would
        // promise « Épargne à ajouter » with no callout to act on.
        isRepairable:
          canRepair &&
          month.hasBudget === true &&
          month.isProvisionable === true,
        isOpen,
        blockedByRealization,
        withdrawalBudgetId: planLinkedWithdrawal?.budgetId ?? null,
        isAdjusted: simulated ? (sim.isAdjusted ?? false) : false,
        amount: simulated ? sim.simulatedAmount : month.plannedAmount,
        cumulative: simulated
          ? sim.simulatedCumulative
          : month.plannedCumulative,
        isWithdrawalOnly: month.isContributionEligible === false,
        withdrawn: month.withdrawnAmount ?? 0,
        plannedWithdrawal: month.plannedWithdrawalAmount ?? 0,
      };
    });
  });

  readonly #lastLockedIndex = computed(() => {
    const rows = this.rows();
    let index = -1;
    rows.forEach((row, i) => {
      if (row.isLocked) index = i;
    });
    return index;
  });

  protected readonly visibleRows = computed<GoalPlanTimelineVisibleRow[]>(
    () => {
      const rows = this.rows();
      const start = this.expanded() ? 0 : Math.max(0, this.#lastLockedIndex());
      const end = this.expanded() ? rows.length : start + WINDOW_OPEN_ROWS + 1;
      const windowed = rows.slice(start, end);
      // Year divider at the first visible row and whenever the year changes — a
      // 36-month plan spans several years, so the month name alone is ambiguous.
      return windowed.map((row, index) => ({
        ...row,
        showYear: index === 0 || row.year !== windowed[index - 1].year,
      }));
    },
  );

  protected readonly hiddenCount = computed(
    () => this.rows().length - this.visibleRows().length,
  );

  // Counts the same rows as the "Pas de budget" chip (the final branch of
  // the !hasLinkedForecast ternary above), not a period-based `isGap` test —
  // a current month with no budget shows that chip too and must be counted.
  // A withdrawal-only month shows no chip at all: nothing is missing from it,
  // it was never open to contributions.
  protected readonly gapCount = computed(
    () =>
      this.rows().filter(
        (row) =>
          !row.isWithdrawalOnly && !row.hasLinkedForecast && !row.hasBudget,
      ).length,
  );

  protected formatPeriod(month: number, year: number): string {
    return formatBudgetPeriod(month, year, this.payDayOfMonth(), this.locale());
  }

  protected lockedAmountLabel(row: GoalPlanTimelineRow): string | null {
    if (row.blockedByRealization) {
      return this.#transloco.translate(
        'savingsGoals.plan.realizedWithdrawalLock',
      );
    }
    if (!row.isChecked) return null;
    const amount = `${formatNumber(row.amount, this.locale(), '1.0-2')} ${this.currency()}`;
    return this.#transloco.translate('savingsGoals.detail.lockedAmountAria', {
      amount,
    });
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
  protected onAmountInput(row: GoalPlanTimelineRow, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    if (raw === '') {
      // Champ vidé pour retaper : incomplet, pas fautif. Rien n'est appliqué.
      this.hasEditError.set(false);
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
