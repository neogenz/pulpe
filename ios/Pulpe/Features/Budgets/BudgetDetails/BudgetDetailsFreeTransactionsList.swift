import SwiftUI

/// Inline free-transactions list for the budget detail screen.
///
/// Replaces the List-bound `TransactionSection` when the parent uses
/// `ScrollView/LazyVStack`. Each row is a tap target that opens the
/// transaction edit sheet (matching the budget-line detail flow).
struct BudgetDetailsFreeTransactionsList: View {
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onTap: (Transaction) -> Void

    @State private var isExpanded = false
    private let collapsedItemCount = 3

    private var displayedTransactions: [Transaction] {
        if isExpanded || transactions.count <= collapsedItemCount {
            return transactions
        }
        return Array(transactions.prefix(collapsedItemCount))
    }

    private var hasMoreItems: Bool { transactions.count > collapsedItemCount }
    private var hiddenItemsCount: Int { transactions.count - collapsedItemCount }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.xxs) {
                Text("Transactions libres")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)
                Text(" · \(transactions.count)")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            .accessibilityLabel("Transactions libres, \(transactions.count)")
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(displayedTransactions) { transaction in
                Button {
                    onTap(transaction)
                } label: {
                    TransactionRow(
                        transaction: transaction,
                        isSyncing: syncingIds.contains(transaction.id)
                    )
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .background(Color.surfaceContainerLowest)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
                    .shadow(DesignTokens.Shadow.subtle)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Touche pour modifier")
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
            }

            if hasMoreItems {
                Button {
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.quickSnap)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack {
                        Text(isExpanded ? "Voir moins" : "Voir plus (+\(hiddenItemsCount))")
                            .font(PulpeTypography.subheadline)
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .textLinkButtonStyle()
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }
}
