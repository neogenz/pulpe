import Foundation

/// History fixtures of the savings-goal UI-test harness: the withdrawals. Split out of
/// `SavingsGoalIntervalUITestHarness` so the service stays under `type_body_length`: the
/// fixtures are pure data and read better here than among the goal's write paths.
///
/// Only the FULL scenario carries them. It is the one the detail screen is
/// photographed on, and the other scenarios exist to prove a region *disappears*
/// — data there would defeat their point.
extension SavingsGoalIntervalUITestService {
    /// « À venir » holds a linked withdrawal (tappable, opens its budget) beside a
    /// plan-only one (no budget, so no chevron and no button); « Historique » holds
    /// the realized one.
    func withdrawalFixtures() -> SavingsGoalWithdrawalsReadModel {
        guard scenario == .savingsGoalDetailFull else {
            return SavingsGoalWithdrawalsReadModel(withdrawals: [])
        }
        return SavingsGoalWithdrawalsReadModel(
            withdrawals: [
                SavingsGoalWithdrawal(
                    transactionId: "withdrawal-1",
                    budgetId: "budget-1",
                    name: "Acompte agence",
                    transactionDate: Self.fixtureDate,
                    amount: 200,
                    checkedAt: Self.fixtureDate
                ),
            ],
            planned: [
                SavingsGoalPlannedWithdrawal(
                    budgetLineId: "planned-withdrawal-1",
                    budgetId: "budget-2",
                    name: "Billets d'avion",
                    month: 9,
                    year: 2027,
                    plannedAmount: 800,
                    realizedAmount: 0,
                    remainingAmount: 800,
                    status: .planned
                ),
            ],
            planOnly: [
                SavingsGoalPlanOnlyWithdrawal(
                    planWithdrawalId: "plan-only-withdrawal-1",
                    name: "Hôtel",
                    month: 10,
                    year: 2027,
                    plannedAmount: 400
                ),
            ]
        )
    }
}
