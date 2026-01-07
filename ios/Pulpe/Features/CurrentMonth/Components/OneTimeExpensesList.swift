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

/// Single transaction row - Clean, Revolut-inspired design
struct TransactionRow: View {
    let transaction: Transaction
    let onToggle: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 12) {
            // Check button
            checkButton

            // Main content
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                    .strikethrough(transaction.isChecked, color: .secondary)
                    .lineLimit(1)

                // Date
                Text(transaction.transactionDate.dayMonthFormatted)
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
        .padding(.vertical, 14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
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

    private var checkButton: some View {
        Button(action: onToggle) {
            ZStack {
                Circle()
                    .stroke(transaction.isChecked ? Color.pulpePrimary : Color(.systemGray4), lineWidth: 2)
                    .frame(width: 26, height: 26)

                if transaction.isChecked {
                    Circle()
                        .fill(Color.pulpePrimary)
                        .frame(width: 26, height: 26)

                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            .animation(.spring(duration: 0.2), value: transaction.isChecked)
        }
        .buttonStyle(.plain)
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
