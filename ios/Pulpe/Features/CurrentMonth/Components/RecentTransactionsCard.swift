import SwiftUI

/// Card showing the 5 most recent transactions for dashboard
struct RecentTransactionsCard: View {
    let transactions: [Transaction]
    let onViewAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Transaction rows
            VStack(spacing: 0) {
                ForEach(transactions, id: \.id) { transaction in
                    RecentTransactionCardRow(transaction: transaction)
                }
            }

            // View all button
            Button(action: onViewAll) {
                HStack {
                    Text("Voir tout")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
        }
        .pulpeCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Transactions récentes, \(transactions.count) transactions")
    }
}

/// Transaction row for dashboard card
private struct RecentTransactionCardRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle
            Circle()
                .fill(transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: transaction.kind.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(transaction.kind.color)
                }

            // Name and date
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer()

            // Amount
            Text(transaction.signedAmount.asCHF)
                .font(.system(.callout, design: .rounded, weight: .semibold))
                .foregroundStyle(transaction.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(transaction.name), \(transaction.kind.label), \(transaction.transactionDate.relativeFormatted), \(transaction.signedAmount.asCHF)")
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
}
