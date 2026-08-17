import Foundation

/// History fixtures of the savings-goal UI-test harness — « Ton suivi » and
/// « Retraits ». Split out of `SavingsGoalIntervalUITestHarness` so the service
/// stays under `type_body_length`: the two read models are pure data and read
/// better beside each other than buried among the goal's write paths.
///
/// Only the FULL scenario carries them. It is the one the detail screen is
/// photographed on, and the other scenarios exist to prove a region *disappears*
/// — data there would defeat their point.
extension SavingsGoalIntervalUITestService {
    /// Two contributions, one already realized, so « Ton suivi » renders its
    /// nested « Réel » list instead of two identical rows.
    func contributionFixtures() -> [SavingsGoalContribution] {
        guard scenario == .savingsGoalDetailFull else { return [] }
        return [
            SavingsGoalContribution(
                lineId: "contribution-1",
                name: "Épargne voyage",
                amount: 300,
                checkedAt: Self.fixtureDate,
                budgetMonth: 6,
                budgetYear: 2027,
                transactions: [
                    Transaction(
                        id: "contribution-transaction-1",
                        budgetId: "budget-1",
                        budgetLineId: "contribution-1",
                        name: "Virement Yuh",
                        amount: 300,
                        kind: .saving,
                        transactionDate: Self.fixtureDate,
                        category: nil,
                        checkedAt: Self.fixtureDate,
                        createdAt: Self.fixtureDate,
                        updatedAt: Self.fixtureDate
                    ),
                ]
            ),
            SavingsGoalContribution(
                lineId: "contribution-2",
                name: "Épargne voyage",
                amount: 300,
                checkedAt: nil,
                budgetMonth: 7,
                budgetYear: 2027,
                transactions: []
            ),
        ]
    }

    /// « Retraits planifiés » holds a linked withdrawal (tappable, opens its
    /// budget) beside a plan-only one (no budget, so no chevron and no button);
    /// « Retraits réalisés » holds the history.
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
