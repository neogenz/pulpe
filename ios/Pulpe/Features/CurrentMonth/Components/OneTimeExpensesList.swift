import SwiftUI

/// List of free (unallocated) transactions
struct OneTimeExpensesList: View {
    let title: String
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void
    let onDelete: (Transaction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .sectionHeader()
                .padding(.horizontal)

            VStack(spacing: 6) {
                ForEach(transactions) { transaction in
                    TransactionRow(
                        transaction: transaction,
                        onToggle: { onToggle(transaction) },
                        onDelete: { onDelete(transaction) }
                    )
                }
            }
            .padding(.horizontal)
        }
    }
}

/// Single transaction row - Aligned with BudgetLineRow design
struct TransactionRow: View {
    let transaction: Transaction
    let onToggle: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 14) {
            // Check button - same design as BudgetLineRow
            Button(action: onToggle) {
                ZStack {
                    Circle()
                        .stroke(transaction.isChecked ? Color.green : Color(.systemGray4), lineWidth: 2)
                        .frame(width: 24, height: 24)

                    if transaction.isChecked {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 24, height: 24)

                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .buttonStyle(.plain)

            // Main content
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                    .strikethrough(transaction.isChecked, color: .secondary)
                    .lineLimit(1)

                // Subtitle: kind badge + date
                HStack(spacing: 4) {
                    KindBadge(transaction.kind, style: .compact)

                    Text(transaction.transactionDate.dayMonthFormatted)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer(minLength: 8)

            // Amount - colored by kind
            Text(transaction.amount.asCHF)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .foregroundStyle(transaction.isChecked ? .secondary : transaction.kind.color)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
        }
        .confirmationDialog(
            "Supprimer cette transaction ?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                onDelete()
            }
            Button("Annuler", role: .cancel) {}
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
                name: "Courses",
                amount: 120,
                kind: .expense,
                transactionDate: Date(),
                category: nil,
                checkedAt: Date(),
                createdAt: Date(),
                updatedAt: Date()
            )
        ],
        onToggle: { _ in },
        onDelete: { _ in }
    )
    .padding()
    .background(Color(.systemGroupedBackground))
}
