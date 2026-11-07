import SwiftUI

/// « Faire un retrait » from a goal: opens Nouveau revenu on the current month with
/// « depuis mon épargne » and that goal already chosen. The app shell sets it so the
/// goals feature never reaches into the add flow; `nil` hides the entry.
extension EnvironmentValues {
    @Entry var requestGoalWithdrawal: ((String) -> Void)?
}

extension View {
    /// Provides `requestGoalWithdrawal` to everything below and presents its sheet.
    func goalWithdrawalFlow() -> some View {
        modifier(GoalWithdrawalFlow())
    }
}

private struct GoalWithdrawalFlow: ViewModifier {
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var request: Request?

    private struct Request: Identifiable {
        let goalId: String
        var id: String { goalId }
    }

    func body(content: Content) -> some View {
        content
            .environment(\.requestGoalWithdrawal) { request = Request(goalId: $0) }
            .sheet(item: $request) { request in
                if let budget = currentMonthStore.budget {
                    MovementSheet(
                        context: MovementSheetContext(
                            store: currentMonthStore, budgetId: budget.id, source: .addButton
                        ),
                        userCurrency: userSettingsStore.currency,
                        withdrawalGoalId: request.goalId,
                        onAdd: currentMonthStore.addTransaction
                    )
                }
            }
    }
}
