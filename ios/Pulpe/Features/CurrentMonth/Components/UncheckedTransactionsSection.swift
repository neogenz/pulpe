import SwiftUI

/// Section showing transactions that are not yet checked/pointed
struct UncheckedTransactionsSection: View {
    let transactions: [Transaction]
    let onTapViewBudget: () -> Void

    var body: some View {
        if !transactions.isEmpty {
            Section {
                ForEach(transactions) { transaction in
                    UncheckedTransactionRow(transaction: transaction)
                }

                Button(action: onTapViewBudget) {
                    HStack {
                        Text("Comptabiliser dans le budget")
                            .font(PulpeTypography.buttonSecondary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textTertiary)
                    }
                }
            } header: {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundStyle(Color.financialOverBudget)
                    Text("À comptabiliser")
                        .font(PulpeTypography.labelLarge)
                }
                .textCase(nil)
            }
        }
    }
}

/// Read-only unchecked transaction row
private struct UncheckedTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Unchecked indicator
            ZStack {
                Circle()
                    .fill(Color.financialOverBudget.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 36, height: 36)

                Image(systemName: transaction.kind.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.financialOverBudget)
            }

            // Name and date
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(PulpeTypography.buttonSecondary)
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer()

            // Amount
            Text(transaction.signedAmount.asCHF)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(transaction.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}

#Preview {
    List {
        UncheckedTransactionsSection(
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
                    name: "Loyer",
                    amount: 1800,
                    kind: .expense,
                    transactionDate: Date().addingTimeInterval(-86400),
                    category: nil,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            ],
            onTapViewBudget: {}
        )
    }
    .listStyle(.insetGrouped)
}
