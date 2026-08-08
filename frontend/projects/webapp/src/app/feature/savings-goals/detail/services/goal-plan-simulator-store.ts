import { Service, computed, inject, signal } from '@angular/core';
import {
  allocateMonthAmountToLines,
  isContributivePlanMonth,
  redistributeRemainingEffort,
  simulateSavingsPlan,
  type RedistributeRemainingEffortResult,
  type SavingsGoalPlanApply,
  type SavingsGoalPlanMonth,
  type SavingsPlanAdjustment,
  type SavingsPlanSimulationResult,
} from 'pulpe-shared';
import { SavingsGoalStore } from '../../services/savings-goals-store';

function periodKeyOf(item: { month: number; year: number }): number {
  return item.year * 12 + item.month;
}

const SLIDER_MIN_CEIL = 100;

/** Le mouvement mensuel est signé : positif = épargne, négatif = retrait. */
function isApplicableMonthAmount(amount: number): boolean {
  return Number.isFinite(amount);
}

/** Le contrôle global reste un effort d'épargne uniforme, donc non négatif. */
function isApplicableGlobalAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= 0;
}

/** Rounds up to the nearest power-of-ten multiple for a serene slider max. */
function niceCeil(value: number): number {
  if (value <= 0) return SLIDER_MIN_CEIL;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * Sandbox de simulation (docs/SAVINGS.md §10.3). Fourni dans les
 * `providers` du composant page : il meurt avec la page, donc le brouillon est
 * auto-abandonné à la navigation (loi de Tesler — la complexité reste absorbée
 * par le système, rien n'est écrit sans accord explicite). Toute la math vient
 * du calculateur `pulpe-shared` ; ce store ne fait qu'orchestrer overrides →
 * `simulateSavingsPlan`.
 */
@Service({ autoProvided: false })
export class GoalPlanSimulatorStore {
  readonly #store = inject(SavingsGoalStore);

  // ── State ──
  readonly #isSimulating = signal(false);
  readonly #overrides = signal<Map<number, number>>(new Map());
  readonly #globalAmount = signal<number | null>(null);
  readonly #isGlobalAmountInvalid = signal(false);
  readonly #isMonthAmountInvalid = signal(false);

  // ── Computed ──
  readonly isSimulating = this.#isSimulating.asReadonly();
  readonly globalAmount = this.#globalAmount.asReadonly();

  /**
   * Deux champs indépendants refusent une saisie : le montant global de la
   * barre et le champ inline d'un mois. Un drapeau unique les faisait se
   * recouvrir — ouvrir l'éditeur d'un mois effaçait le refus que la barre
   * affichait encore, et « Appliquer » rouvrait sous une erreur toujours à
   * l'écran. Chacun garde donc le sien ; le verrou est leur réunion.
   */
  readonly hasInvalidAmount = computed(
    () => this.#isGlobalAmountInvalid() || this.#isMonthAmountInvalid(),
  );

  readonly baseline = computed<SavingsGoalPlanMonth[]>(
    () => this.#store.progress()?.months ?? [],
  );
  readonly targetAmount = computed(
    () => this.#store.progress()?.targetAmount ?? null,
  );
  readonly hasTarget = computed(() => this.targetAmount() != null);

  readonly openMonthCount = computed(
    () =>
      this.baseline().filter((month) => isContributivePlanMonth(month)).length,
  );

  /** Slider anchor (ancrage DA) — the amount that holds the deadline. */
  readonly defaultMonthlyAmount = computed(() => {
    const progress = this.#store.progress();
    return Math.round(progress?.required ?? progress?.pace ?? 0);
  });

  /** `niceCeil(2 × max(required, pace, plannedAmount))` — docs/SAVINGS.md §10.3. */
  readonly sliderMax = computed(() => {
    const progress = this.#store.progress();
    const required = progress?.required ?? 0;
    const pace = progress?.pace ?? 0;
    const maxPlanned = this.baseline().reduce(
      (max, month) => Math.max(max, month.plannedAmount),
      0,
    );
    return niceCeil(2 * Math.max(required, pace, maxPlanned, SLIDER_MIN_CEIL));
  });

  /** Representative monthly amount of the current open plan — seeds the slider
   *  so the simulator opens on the user's *real* plan (not the deadline anchor),
   *  keeping the slider consistent with the verdict. Falls back to the anchor
   *  when there is no open month to read. */
  readonly currentMonthlyAmount = computed(() => {
    const firstOpen = this.baseline().find((month) =>
      isContributivePlanMonth(month),
    );
    return firstOpen
      ? Math.round(firstOpen.plannedAmount)
      : this.defaultMonthlyAmount();
  });

  /** CTA « Ajuster mon plan » : ACTIVE + au moins une ligne liée + un mois ouvert. */
  readonly canSimulate = computed(() => {
    const progress = this.#store.progress();
    if (!progress) return false;
    return (
      progress.status === 'ACTIVE' &&
      progress.linkedLineCount > 0 &&
      this.openMonthCount() >= 1
    );
  });

  readonly #adjustments = computed<SavingsPlanAdjustment[]>(() => {
    const overrides = this.#overrides();
    const result: SavingsPlanAdjustment[] = [];
    for (const month of this.baseline()) {
      const key = periodKeyOf(month);
      if (overrides.has(key) && isContributivePlanMonth(month)) {
        result.push({
          month: month.month,
          year: month.year,
          amount: overrides.get(key)!,
          replacesPlanWithdrawal:
            (month.planOnlyWithdrawalAmount ?? 0) +
              (month.planLinkedWithdrawalAmount ?? 0) >
            0,
        });
      }
    }
    return result;
  });

  readonly draft = computed<SavingsPlanSimulationResult | null>(() => {
    if (!this.#isSimulating()) return null;
    const timeline = this.baseline();
    if (timeline.length === 0) return null;
    return simulateSavingsPlan({
      timeline,
      targetAmount: this.targetAmount(),
      adjustments: this.#adjustments(),
      globalMonthlyAmount: this.#globalAmount() ?? undefined,
      initialAmount: this.#store.progress()?.initialAmount ?? 0,
    });
  });

  readonly draftRows = computed(() => this.draft()?.months ?? []);

  /** True when open months cannot be represented by one global control value. */
  readonly hasVariableAmounts = computed(() => {
    const amounts = this.draftRows()
      .filter((month) => isContributivePlanMonth(month))
      .map((month) => month.simulatedAmount);
    return (
      amounts.length > 1 && amounts.some((amount) => amount !== amounts[0])
    );
  });

  /** Nombre de mois ouverts dont le montant simulé diffère du prévu. */
  readonly dirtyCount = computed(
    () => this.draft()?.months.filter((month) => month.isAdjusted).length ?? 0,
  );

  readonly hasChanges = computed(() => this.dirtyCount() > 0);

  /**
   * « Appliquer » exige des changements ET aucune saisie en cours refusée. Le
   * champ garde son texte invalide tant que l'utilisateur le corrige : sans ce
   * verrou, cliquer « Appliquer » écrirait le dernier montant valide alors que
   * l'écran en affiche un autre.
   */
  readonly canApply = computed(
    () => this.hasChanges() && !this.hasInvalidAmount(),
  );

  // ── Actions ──
  enter(): void {
    this.#reset();
    this.#isSimulating.set(true);
  }

  exit(): void {
    this.#isSimulating.set(false);
    this.#reset();
  }

  /** « Repartir du plan actuel » — efface les overrides sans quitter le mode. */
  revert(): void {
    this.#reset();
  }

  /**
   * Une saisie refusée n'est pas corrigée en silence : elle laisse le plan tel
   * quel et le champ garde son erreur. Clamper avec `Math.max(0, …)` écrivait
   * un montant que l'utilisateur n'avait pas demandé et faisait disparaître le
   * sien sans rien dire.
   */
  setMonth(month: number, year: number, amount: number): void {
    if (!isApplicableMonthAmount(amount)) return;
    const key = year * 12 + month;
    const target = this.baseline().find((item) => periodKeyOf(item) === key);
    if (!target || !isContributivePlanMonth(target)) return;

    const next = new Map(this.#overrides());
    next.set(key, amount);
    this.#overrides.set(next);
  }

  /** Bouger le slider écrase tous les overrides par mois (annoncé par la toolbar). */
  setGlobalAmount(amount: number): void {
    if (!isApplicableGlobalAmount(amount)) return;
    this.#overrides.set(new Map());
    this.#globalAmount.set(amount);
  }

  /** Le montant global de la barre signale sa saisie refusée. */
  setGlobalAmountInvalid(isInvalid: boolean): void {
    this.#isGlobalAmountInvalid.set(isInvalid);
  }

  /** Le champ inline d'un mois signale la sienne. */
  setMonthAmountInvalid(isInvalid: boolean): void {
    this.#isMonthAmountInvalid.set(isInvalid);
  }

  /** « Réajuster la suite » — répartit l'effort restant sur les mois ouverts. */
  redistribute(): RedistributeRemainingEffortResult {
    const result = redistributeRemainingEffort({
      timeline: this.baseline(),
      targetAmount: this.targetAmount(),
      pinnedAdjustments: this.#adjustments(),
      initialAmount: this.#store.progress()?.initialAmount ?? 0,
    });
    if (result.isDistributable) {
      const next = new Map(this.#overrides());
      for (const adjustment of result.adjustments) {
        next.set(periodKeyOf(adjustment), adjustment.amount);
      }
      this.#overrides.set(next);
      const openAmounts = this.baseline()
        .filter((month) => isContributivePlanMonth(month))
        .map((month) => next.get(periodKeyOf(month)) ?? month.plannedAmount);
      const uniformAmount = openAmounts[0];
      const isUniform = openAmounts.every((amount) => amount === uniformAmount);
      this.#globalAmount.set(isUniform ? uniformAmount : null);
    }
    return result;
  }

  buildApplyPayload(
    withdrawalDestination: 'goal_only' | 'linked_income' = 'goal_only',
  ): SavingsGoalPlanApply {
    const draft = this.draft();
    const monthAdjustments: SavingsGoalPlanApply['monthAdjustments'] = [];
    const missingMonthAdjustments: NonNullable<
      SavingsGoalPlanApply['missingMonthAdjustments']
    > = [];
    const planWithdrawalAdjustments: NonNullable<
      SavingsGoalPlanApply['planWithdrawalAdjustments']
    > = [];
    if (draft) {
      for (const month of draft.months) {
        if (!month.isAdjusted) continue;
        if (month.simulatedAmount < 0) {
          planWithdrawalAdjustments.push({
            month: month.month,
            year: month.year,
            amount: month.simulatedAmount,
            destination: withdrawalDestination,
          });
          continue;
        }
        if (
          (month.planOnlyWithdrawalAmount ?? 0) +
            (month.planLinkedWithdrawalAmount ?? 0) >
          0
        ) {
          planWithdrawalAdjustments.push({
            month: month.month,
            year: month.year,
            amount: 0,
            destination: withdrawalDestination,
          });
        }
        if (month.isProvisionable) {
          // A zero-valued creation describes nothing to create. The server
          // drops it too (older clients still send it), but there is no point
          // spending a round-trip carrying an instruction that means nothing.
          if (month.simulatedAmount === 0) continue;
          missingMonthAdjustments.push({
            month: month.month,
            year: month.year,
            amount: month.simulatedAmount,
          });
          continue;
        }
        const allocated = allocateMonthAmountToLines(
          month.lines.map((line) => ({
            budgetLineId: line.budgetLineId,
            amount: line.amount,
            checkedAt: line.checkedAt,
          })),
          month.simulatedAmount,
        );
        monthAdjustments.push(...allocated);
      }
    }
    return {
      monthAdjustments,
      missingMonthAdjustments,
      planWithdrawalAdjustments,
    };
  }

  async apply(
    withdrawalDestination: 'goal_only' | 'linked_income' = 'goal_only',
  ): Promise<void> {
    const goal = this.#store.selectedGoal();
    if (!goal) throw new Error('No goal selected');
    const payload = this.buildApplyPayload(withdrawalDestination);
    // A zero-valued gap creation can be the only "adjusted" month left after
    // omission (see buildApplyPayload) — nothing left to persist then.
    // `apply()` is a public store entry point: the current caller (this
    // store's own UI) already guarantees a non-empty payload upstream, but
    // this guard is what keeps a future caller from ever sending an empty
    // apply request — it protects the boundary, not a producer guarantee.
    const hasPayload =
      payload.monthAdjustments.length > 0 ||
      (payload.missingMonthAdjustments?.length ?? 0) > 0 ||
      (payload.planWithdrawalAdjustments?.length ?? 0) > 0;
    if (hasPayload) {
      await this.#store.applyPlan(goal.id, payload);
    }
    this.exit();
  }

  // ── Helpers ──
  #reset(): void {
    this.#overrides.set(new Map());
    this.#globalAmount.set(null);
    this.#isGlobalAmountInvalid.set(false);
    this.#isMonthAmountInvalid.set(false);
  }
}
