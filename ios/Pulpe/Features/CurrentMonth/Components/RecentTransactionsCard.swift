import SwiftUI

/// Card showing the 5 most recent transactions for dashboard
struct RecentTransactionsCard: View {
    let transactions: [Transaction]
    let onViewAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            Text("Transactions récentes")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.primary)

            // Transaction rows
            VStack(spacing: 8) {
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
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Transactions récentes, \(transactions.count) transactions")
    }
}

/// Transaction row for dashboard card
private struct RecentTransactionCardRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            // Kind icon circle
            Circle()
                .fill(transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: 32, height: 32)
                .overlay {
                    Image(systemName: transaction.kind.listIcon)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(transaction.kind.color)
                }

            // Name and date
            VStack(alignment: .leading, spacing: 1) {
                Text(transaction.name)
                    .font(.subheadline)
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Amount
            Text(transaction.signedAmount.asCHF)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(transaction.kind.color)
        }
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
    .background(Color(.systemGroupedBackground))
}
