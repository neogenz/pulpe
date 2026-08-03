import SwiftUI

// MARK: - Savings-goal origin (PUL-329)

/// The origin block of the transaction editor, split out to keep the page under
/// the feature's 350-LOC budget (same precedent as `+Routing`). The members used
/// here (`router`, `savingsGoalStore`) are declared non-private on the page for
/// this reason.
extension EditTransactionPage {
    /// States where the money came from, and — while the goal still exists —
    /// leads to it. There is deliberately no control to change or re-point the
    /// origin: it is fixed at creation, and the server refuses to move it.
    @ViewBuilder
    func savingsGoalSourceSection(for tx: Transaction) -> some View {
        if let source = tx.savingsGoalSource {
            switch source {
            case .active(let goalId, _):
                ContextLinkRow(
                    icon: source.icon,
                    iconTint: .financialSavings,
                    title: source.label,
                    accessibilityLabel: source.accessibilityLabel,
                    accessibilityHint: "Touche pour ouvrir l'objectif",
                    action: { openSavingsGoal(id: goalId) }
                )
                // The push needs the goal itself, so warm the cache while the
                // row is on screen rather than at tap time.
                .task { await savingsGoalStore.loadIfNeeded() }
            case .broken:
                // No action, no chevron: the goal is gone, so a row that looked
                // navigable would promise a screen that cannot open.
                ContextLinkRow(
                    icon: source.icon,
                    iconTint: .textTertiary,
                    title: source.label,
                    detail: SavingsGoalSource.brokenExplanation,
                    accessibilityLabel: source.accessibilityLabel
                )
            }
        }
    }

    /// Pushes the goal onto the on-screen stack. Resolving through the app-level
    /// cache keeps the id honest: a goal deleted from another device simply does
    /// not resolve, and the tap stays a no-op rather than pushing an empty page.
    private func openSavingsGoal(id: String) {
        guard let goal = savingsGoalStore.goals.first(where: { $0.id == id }) else { return }
        router.pushSavingsGoal(goal)
    }
}
