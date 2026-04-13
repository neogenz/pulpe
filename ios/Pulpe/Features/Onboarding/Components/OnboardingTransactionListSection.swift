import SwiftUI

/// Reusable section listing custom onboarding transactions of a single kind.
/// Replaces the near-identical `customChargesSection` / `customSavingsSection` /
/// `customIncomesSection` blocks that previously lived in each step file.
///
/// The lookup-by-id and animated-remove logic is consolidated here so each step
/// only declares the section's title, icon, and the filtered transaction array.
struct OnboardingTransactionListSection: View {
    let title: String
    let icon: String
    let transactions: [OnboardingTransaction]
    let state: OnboardingState
    let onEdit: (OnboardingTransaction) -> Void

    var body: some View {
        OnboardingSectionHeader(title: title, icon: icon) {
            ForEach(transactions) { tx in
                if tx.id != transactions.first?.id {
                    Divider().opacity(DesignTokens.Opacity.accent)
                }
                OnboardingTransactionRow(
                    transaction: tx,
                    onEdit: { onEdit(tx) },
                    onRemove: { remove(tx) }
                )
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
