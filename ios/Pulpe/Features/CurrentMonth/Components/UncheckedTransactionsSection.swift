import SwiftUI

/// Section showing transactions that are not yet checked/pointed
struct UncheckedTransactionsSection: View {
    let transactions: [Transaction]
    let onTapViewBudget: () -> Void

    var body: some View {
        if transactions.isEmpty { return AnyView(EmptyView()) }

        return AnyView(
            Section {
                ForEach(transactions) { transaction in
                    UncheckedTransactionRow(transaction: transaction)
                }

                Button(action: onTapViewBudget) {
                    HStack {
                        Text("Comptabiliser dans le budget")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(Color.textTertiary)
                    }
                }
            } header: {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundStyle(.orange)
                    Text("À comptabiliser")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .textCase(nil)
            }
        )
    }
}

/// Read-only unchecked transaction row
private struct UncheckedTransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            // Unchecked indicator
            ZStack {
                Circle()
                    .stroke(Color.orange, lineWidth: 2)
                    .frame(width: 36, height: 36)

                Image(systemName: transaction.kind.listIcon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.orange)
            }

            // Name and date
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(transaction.transactionDate.relativeFormatted)
                    .font(.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer()

            // Amount
            Text(transaction.signedAmount.asCHF)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(transaction.kind.color)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Transaction extension for signed amount

private extension Transaction {
    var signedAmount: Decimal {
        switch kind {
        case .income: amount
        case .expense, .saving: -amount
        }
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
