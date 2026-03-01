import SwiftUI

/// Section showing the 5 most recent transactions (read-only)
struct RecentTransactionsSection: View {
    let transactions: [Transaction]
    let onTapViewAll: () -> Void

    var body: some View {
        if !transactions.isEmpty {
            Section {
                ForEach(transactions) { transaction in
                    RecentTransactionRow(transaction: transaction)
                }

                Button(action: onTapViewAll) {
                    HStack {
                        Text("Voir tout")
                            .font(PulpeTypography.buttonSecondary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.pulpeTextTertiary)
                    }
                }
            } header: {
                Text("Dernières dépenses")
                    .font(PulpeTypography.labelLarge)
                    .textCase(nil)
            }
        }
    }
}

/// Read-only transaction row for dashboard
private struct RecentTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle
            ZStack {
                Circle()
                    .fill(transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 40, height: 40)

                Image(systemName: transaction.kind.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(transaction.kind.color)
            }

            // Name and date
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(.system(.body, weight: .semibold))
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Amount
            Text(transaction.signedAmount.asAmount)
                .font(.system(.callout, weight: .regular))
                .foregroundStyle(transaction.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
    }
}

#Preview {
    List {
        RecentTransactionsSection(
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
            onTapViewAll: {}
        )
    }
    .listStyle(.insetGrouped)
}
