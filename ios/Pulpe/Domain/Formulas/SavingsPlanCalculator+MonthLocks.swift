import Foundation

/// The two locks a plan month can carry, mirroring `savings-goal-plan.ts`.
/// They are orthogonal: `isLocked` says the month's CONTRIBUTION is settled,
/// the realization lock says its WITHDRAWAL is no longer replanifiable.
extension SavingsPlanCalculator {
    /// A month is editable when it carries at least one unchecked line and is not
    /// locked (past cycle / everything pointé). Gap months (no lines) are never open.
    static func isOpenPlanMonth(_ month: SavingsGoalPlanMonth) -> Bool {
        let hasUncheckedLine = month.lines.contains { $0.checkedAt == nil }
        return !month.isLocked && hasUncheckedLine
    }

    /// A withdrawal that started being realized freezes its month: the amount is
    /// already partly real, so it is no longer replanifiable. Distinct from
    /// `isLocked` — a frozen month may still owe its unchecked forecast, which is
    /// why it must not be mistaken for an unavailable period.
    static func isPlanWithdrawalFrozenMonth(_ month: SavingsGoalPlanMonth) -> Bool {
        month.planWithdrawalConsumedAmount > SavingsGoalProgress.withdrawalBalanceTolerance
    }

    /// A month participates in global simulation and redistribution when it is
    /// editable now or can be created from the linked default template.
    static func isContributivePlanMonth(_ month: SavingsGoalPlanMonth) -> Bool {
        month.isContributionEligible
            && !isPlanWithdrawalFrozenMonth(month)
            && (isOpenPlanMonth(month) || month.isProvisionable)
    }
}
