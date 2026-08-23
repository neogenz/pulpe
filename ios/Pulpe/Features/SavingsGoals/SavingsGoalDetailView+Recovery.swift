import Foundation

/// Recovery-plan derivations for the goal detail screen: who may adjust, what a repair
/// would write, and the sentence that sums it up.
extension SavingsGoalDetailView {
    /// Simulator entry (pilier C): active goal, at least one linked line, at least
    /// one open month. Hidden for PAUSED/COMPLETED (no rhythm verdict → no editing).
    func canAdjust(_ progress: SavingsGoalProgress) -> Bool {
        guard currentGoal.status == .active, progress.linkedLineCount > 0 else { return false }
        return progress.months.contains { SavingsPlanCalculator.isContributivePlanMonth($0) }
    }

    func recoveryChanges(
        _ progress: SavingsGoalProgress
    ) -> [SavingsPlanCalculator.SimulatedMonth] {
        guard let amount = SavingsGoalDetailViewModel.recoveryAmount(progress) else { return [] }
        // Each repaired month adds `amount` on top of every repair before it, so
        // the running total accumulates — `plannedCumulative + amount` alone would
        // report the same figure for all N months. Mirrors the accumulation
        // `SavingsPlanCalculator.simulate` performs on the adjustment path.
        var repaired = Decimal.zero
        return progress.months.filter(\.isRepairable).map {
            repaired += amount
            return SavingsPlanCalculator.SimulatedMonth(
                month: $0,
                simulatedAmount: amount,
                simulatedCumulative: $0.plannedCumulative + repaired,
                isAdjusted: true,
                replacesExistingPlanWithdrawal: false
            )
        }
    }

    /// Base `displayedProjection`, not `plannedProjection`: the sentence answers
    /// the same question as the hero and the chart endpoint, so it has to start
    /// from the same figure. `plannedProjection` never subtracts a withdrawal,
    /// so on a goal without a target amount it quoted an « après création » above
    /// what the curve reaches — two projections for one plan.
    func recoveryVerdict(_ progress: SavingsGoalProgress) -> String {
        let changes = recoveryChanges(progress)
        let added = changes.reduce(Decimal.zero) { $0 + $1.simulatedAmount }
        return AppLocale.string(
            "Projection après création : \((progress.displayedProjection + added).asAdaptiveCurrency(currency))"
        )
    }
}
