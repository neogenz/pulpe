import SwiftUI
import TipKit

/// The home's add action, and the invitation that explains it while the account has
/// recorded nothing yet (PUL-306).
struct HomeAddOperationRow: View {
    let onAdd: (FirstTransactionTracker.Source) -> Void

    @Environment(CurrentMonthStore.self) private var store
    private var firstTransactionTracker: FirstTransactionTracker { .shared }

    /// The server answers for the whole account; the month's own list is checked too, so
    /// an entry no surface reported still retires the invitation at once.
    private var showsFirstExpenseTip: Bool {
        firstTransactionTracker.isAwaitingFirstTransaction && store.transactions.isEmpty
    }

    var body: some View {
        // The tip sits under the button it explains, low enough on the screen to reach with
        // the thumb. Rendered only while it applies, so no other home pays for its slot.
        VStack(spacing: DesignTokens.Spacing.md) {
            addOperationRow
            if showsFirstExpenseTip {
                TipView(ProductTips.firstExpense) { action in
                    guard action.id == ProductTips.FirstExpenseTip.addExpenseActionId else { return }
                    onAdd(.activationPrompt)
                }
                .pulpeTipBackground()
                .transition(.opacity)
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: showsFirstExpenseTip)
    }

    /// The one filled element in the content zone. Recording an operation is the act the
    /// whole app depends on, and dressed as a white card with a chevron it had the same
    /// weight as the records below it — and promised a list it doesn't open.
    private var addOperationRow: some View {
        Button { onAdd(.addButton) } label: {
            Label("Ajouter une opération", systemImage: "plus")
        }
        .primaryButtonStyle()
        .accessibilityLabel("Ajouter une opération")
        .accessibilityIdentifier("homeAddOperationButton")
    }
}
