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

            VStack(spacing: 8) {
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

/// Single transaction row
struct TransactionRow: View {
    let transaction: Transaction
    let onToggle: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 12) {
            // Check button
            Button {
                onToggle()
            } label: {
                Image(systemName: transaction.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(transaction.isChecked ? .green : .secondary)
            }

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(transaction.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .strikethrough(transaction.isChecked)
                        .foregroundStyle(transaction.isChecked ? .secondary : .primary)

                    Spacer()

                    CurrencyText(transaction.amount, style: .body)
                        .foregroundStyle(transaction.kind.color)
                }

                HStack {
                    KindBadge(transaction.kind, style: .compact)

                    Text(transaction.transactionDate.dayMonthFormatted)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
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
