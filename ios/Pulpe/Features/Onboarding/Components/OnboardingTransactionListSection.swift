import SwiftUI

/// Section listing the custom onboarding transactions of one kind: name and amount per row, a tap
/// edits, an × removes. Each step only declares the title and the filtered transactions.
struct OnboardingTransactionListSection: View {
    let title: String
    let transactions: [OnboardingTransaction]
    let state: OnboardingState
    let onEdit: (OnboardingTransaction) -> Void

    var body: some View {
        OnboardingSectionHeader(title: title) {
            FormCard {
                ForEach(transactions) { tx in
                    if tx.id != transactions.first?.id {
                        FormRowDivider()
                    }
                    OnboardingTransactionRow(
                        transaction: tx,
                        onEdit: { onEdit(tx) },
                        onRemove: { remove(tx) },
                        currency: state.currency
                    )
                }
            }
        }
    }

    private func remove(_ tx: OnboardingTransaction) {
        guard let index = state.customTransactions.firstIndex(where: { $0.id == tx.id }) else {
            return
        }
        withAnimation(DesignTokens.Animation.defaultSpring) {
            state.removeCustomTransaction(at: index)
        }
    }
}
