import SwiftUI

/// List of free (unallocated) transactions
struct OneTimeExpensesList: View {
    let title: String
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void
    let onDelete: (Transaction) -> Void

    private var totalAmount: Decimal {
        transactions.reduce(0) { sum, t in
            switch t.kind {
            case .income: sum + t.amount
            case .expense, .saving: sum - t.amount
            }
        }
    }

    private var totalColor: Color {
        if totalAmount > 0 { return .financialIncome }
        if totalAmount < 0 { return .financialExpense }
        return .secondary
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(
                title: title,
                count: transactions.count,
                totalAmount: totalAmount,
                totalColor: totalColor
            )

            // Use List for native swipe actions
            List {
                ForEach(transactions) { transaction in
                    TransactionRow(transaction: transaction)
                        .listRowInsets(EdgeInsets(top: 3, leading: 16, bottom: 3, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                onDelete(transaction)
                            } label: {
                                Label("Supprimer", systemImage: "trash")
                            }

                            Button {
                                onToggle(transaction)
                            } label: {
                                Label(
                                    transaction.isChecked ? "Annuler" : "Comptabiliser",
                                    systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
                                )
                            }
                            .tint(transaction.isChecked ? .orange : .pulpePrimary)
                        }
                }
            }
            .listStyle(.plain)
            .scrollDisabled(true)
            .frame(height: CGFloat(transactions.count) * 70) // Approximate row height
        }
    }
}

/// Single transaction row - Revolut-inspired design
struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: 12) {
            // Kind icon circle (Revolut-style)
            kindIconCircle

            // Main content
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                    .strikethrough(transaction.isChecked, color: .secondary)
                    .lineLimit(1)

                // Date (relative formatting)
                Text(transaction.transactionDate.relativeFormatted)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Spacer(minLength: 8)

            // Amount
            Text(transaction.amount.asCHF)
                .font(.system(.callout, design: .rounded, weight: .semibold))
                .foregroundStyle(transaction.isChecked ? .secondary : transaction.kind.color)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(transaction.isChecked ? Color(.systemGray5) : transaction.kind.color.opacity(0.15))
                .frame(width: 40, height: 40)

            if transaction.isChecked {
                // Show checkmark when checked
                Image(systemName: "checkmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.secondary)
            } else {
                // Show kind icon
                Image(systemName: transaction.kind.listIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(transaction.kind.color)
            }
        }
    }
}

#Preview {
    OneTimeExpensesList(
        title: "Autres dépenses",
        transactions: [
            Transaction(
                id: "1",
                budgetId: "b1",
                budgetLineId: nil,
                name: "Restaurant",
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
                budgetLineId: nil,
                name: "Remboursement",
                amount: 120,
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
                name: "Virement épargne",
                amount: 200,
                kind: .saving,
                transactionDate: Date().addingTimeInterval(-172800),
                category: nil,
                checkedAt: nil,
                createdAt: Date(),
                updatedAt: Date()
            )
        ],
        onToggle: { _ in },
        onDelete: { _ in }
    )
    .padding(.vertical)
    .background(Color(.systemGroupedBackground))
}
