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
                        Text("Pointer dans le budget")
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
                    Text("À pointer")
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
    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Unchecked indicator
            ZStack {
                Circle()
                    .fill(Color.financialOverBudget.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)

                Image(systemName: transaction.kind.icon)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.financialOverBudget)
            }

            // Name and date
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(PulpeTypography.listRowTitle)
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            // Amount
            TransactionAmountView(transaction: transaction, displayCurrency: userSettingsStore.currency)
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
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
    .environment(UserSettingsStore())
}
