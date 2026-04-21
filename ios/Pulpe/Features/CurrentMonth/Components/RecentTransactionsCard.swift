import SwiftUI

/// Card showing the 5 most recent transactions for dashboard
struct RecentTransactionsCard: View {
    let transactions: [Transaction]
    let onViewAll: () -> Void

    @State private var viewAllTrigger = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Transaction rows
            VStack(spacing: 0) {
                ForEach(transactions, id: \.id) { transaction in
                    RecentTransactionCardRow(transaction: transaction)
                }
            }

            // View all button
            Button {
                viewAllTrigger.toggle()
                onViewAll()
            } label: {
                HStack {
                    Text("Voir tout")
                        .font(PulpeTypography.buttonSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textTertiary)
                }
            }
            .textLinkButtonStyle()
            .sensoryFeedback(.selection, trigger: viewAllTrigger)
        }
        .pulpeCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Transactions récentes, \(transactions.count) transactions")
    }
}

/// Transaction row for dashboard card
private struct RecentTransactionCardRow: View {
    let transaction: Transaction
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle
            Circle()
                .fill(transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                .overlay {
                    Image(systemName: transaction.kind.icon)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(transaction.kind.color)
                }

            // Name and date
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(transaction.name)
                    .font(PulpeTypography.listRowTitle)
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            // Amount
            Text(transaction.amount.asSignedAmount(for: transaction.kind))
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(transaction.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(transaction.name), \(transaction.kind.label), "
            + "\(transaction.transactionDate.relativeFormatted), "
            + "\(amountsHidden ? "Montant masqué" : transaction.amount.asCurrency(userSettingsStore.currency))"
        )
    }
}

// MARK: - Preview

#Preview("Recent Transactions Card") {
    VStack(spacing: 16) {
        RecentTransactionsCard(
            transactions: [
                Transaction(
                    id: "1",
                    budgetId: "b1",
                    budgetLineId: nil,
                    name: "Migros",
                    amount: 45,
                    kind: .expense,
                    transactionDate: Date(),
                    category: nil,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                Transaction(
                    id: "2",
                    budgetId: "b1",
                    budgetLineId: "l1",
                    name: "Salaire",
                    amount: 5000,
                    kind: .income,
                    transactionDate: Date().addingTimeInterval(-86400),
                    category: nil,
                    checkedAt: Date(),
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                Transaction(
                    id: "3",
                    budgetId: "b1",
                    budgetLineId: nil,
                    name: "Spotify",
                    amount: 15,
                    kind: .expense,
                    transactionDate: Date().addingTimeInterval(-172800),
                    category: nil,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            ],
            onViewAll: {}
        )
    }
    .padding()
    .pulpeBackground()
    .environment(UserSettingsStore())
}
