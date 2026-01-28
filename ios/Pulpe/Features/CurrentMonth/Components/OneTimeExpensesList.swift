import SwiftUI

/// Section of free (unallocated) transactions - designed to be used inside a parent List
struct TransactionSection: View {
    let title: String
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: (Transaction) -> Void
    let onDelete: (Transaction) -> Void
    let onEdit: (Transaction) -> Void

    @State private var transactionToDelete: Transaction?
    @State private var showDeleteAlert = false
    @State private var isExpanded = false

    private let collapsedItemCount = 3

    private var displayedTransactions: [Transaction] {
        if isExpanded || transactions.count <= collapsedItemCount {
            return transactions
        }
        return Array(transactions.prefix(collapsedItemCount))
    }

    private var hasMoreItems: Bool {
        transactions.count > collapsedItemCount
    }

    private var hiddenItemsCount: Int {
        transactions.count - collapsedItemCount
    }

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

    @ViewBuilder
    private func swipeActions(for transaction: Transaction) -> some View {
        Button {
            transactionToDelete = transaction
            showDeleteAlert = true
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
        .tint(Color.errorPrimary)

        Button {
            onToggle(transaction)
        } label: {
            Label(
                transaction.isChecked ? "Annuler" : "Comptabiliser",
                systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
            )
        }
        .tint(transaction.isChecked ? Color.financialOverBudget : .pulpePrimary)
    }

    @ViewBuilder
    private var expandCollapseButton: some View {
        if hasMoreItems {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(isExpanded ? "Voir moins" : "Voir plus (+\(hiddenItemsCount))")
                        .font(.subheadline)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .listRowSeparator(.hidden)
        }
    }

    var body: some View {
        Section {
            ForEach(displayedTransactions) { transaction in
                TransactionRow(
                    transaction: transaction,
                    isSyncing: syncingIds.contains(transaction.id),
                    onEdit: { onEdit(transaction) }
                )
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        swipeActions(for: transaction)
                    }
            }

            expandCollapseButton
        } header: {
            SectionHeader(
                title: title,
                count: transactions.count,
                totalAmount: totalAmount,
                totalColor: totalColor
            )
            .textCase(nil)
        }
        .alert(
            "Supprimer cette transaction ?",
            isPresented: $showDeleteAlert,
            presenting: transactionToDelete
        ) { transaction in
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                onDelete(transaction)
            }
        } message: { _ in
            Text("Cette action est irréversible.")
        }
    }
}

/// Single transaction row - Revolut-inspired design
struct TransactionRow: View {
    let transaction: Transaction
    let isSyncing: Bool
    let onEdit: () -> Void

    var body: some View {
        Button(action: onEdit) {
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
                        .foregroundStyle(Color.textTertiary)
                }

                Spacer(minLength: 8)

                // Sync indicator
                SyncIndicator(isSyncing: isSyncing)

                // Amount
                Text(transaction.amount.asCHF)
                    .font(.system(.callout, design: .rounded, weight: .semibold))
                    .foregroundStyle(transaction.isChecked ? .secondary : transaction.kind.color)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Touche pour modifier")
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(transaction.isChecked ? Color.progressTrack : transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
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
    List {
        TransactionSection(
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
            syncingIds: ["1"],
            onToggle: { _ in },
            onDelete: { _ in },
            onEdit: { _ in }
        )
    }
    .listStyle(.insetGrouped)
    .listSectionSpacing(16)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
}
