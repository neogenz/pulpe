import SwiftUI

/// Section of free (unallocated) transactions - designed to be used inside a parent List
/// Note: Deletion now uses undo toast instead of confirmation dialog
struct TransactionSection: View {
    let title: String
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: ((Transaction) -> Void)?
    let onDelete: ((Transaction) -> Void)?
    let onEdit: ((Transaction) -> Void)?

    init(
        title: String,
        transactions: [Transaction],
        syncingIds: Set<String>,
        onToggle: ((Transaction) -> Void)? = nil,
        onDelete: ((Transaction) -> Void)? = nil,
        onEdit: ((Transaction) -> Void)? = nil
    ) {
        self.title = title
        self.transactions = transactions
        self.syncingIds = syncingIds
        self.onToggle = onToggle
        self.onDelete = onDelete
        self.onEdit = onEdit
    }

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
        transactions.reduce(0) { sum, tx in
            switch tx.kind {
            case .income: sum + tx.amount
            case .expense, .saving: sum - tx.amount
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
        if let onDelete {
            Button {
                onDelete(transaction)
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
            .tint(Color.destructivePrimary)
        }

        if let onToggle {
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
    }

    @ViewBuilder
    private var expandCollapseButton: some View {
        if hasMoreItems {
            Button {
                withAnimation(.easeInOut(duration: DesignTokens.Animation.quickSnap)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(isExpanded ? "Voir moins" : "Voir plus (+\(hiddenItemsCount))")
                        .font(PulpeTypography.subheadline)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .textLinkButtonStyle()
            .listRowSeparator(.hidden)
        }
    }

    var body: some View {
        Section {
            ForEach(displayedTransactions) { transaction in
                TransactionRow(
                    transaction: transaction,
                    isSyncing: syncingIds.contains(transaction.id),
                    onEdit: onEdit.map { callback in { callback(transaction) } }
                )
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        if onToggle != nil || onDelete != nil {
                            swipeActions(for: transaction)
                        }
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
    }
}

/// Single transaction row - Revolut-inspired design
struct TransactionRow: View {
    let transaction: Transaction
    let isSyncing: Bool
    let onEdit: (() -> Void)?

    init(transaction: Transaction, isSyncing: Bool, onEdit: (() -> Void)? = nil) {
        self.transaction = transaction
        self.isSyncing = isSyncing
        self.onEdit = onEdit
    }

    @ViewBuilder
    var body: some View {
        if let onEdit {
            Button(action: onEdit) { content }
                .buttonStyle(.plain)
                .accessibilityHint("Touche pour modifier")
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle (Revolut-style)
            kindIconCircle

            // Main content
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(transaction.name)
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                    .strikethrough(transaction.isChecked, color: .secondary)
                    .lineLimit(1)

                // Date (relative formatting)
                Text(transaction.transactionDate.relativeFormatted)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.pulpeTextTertiary)
            }

            Spacer(minLength: 8)

            // Sync indicator
            SyncIndicator(isSyncing: isSyncing)

            // Amount
            Text(transaction.amount.asCHF)
                .font(PulpeTypography.callout.weight(.semibold))
                .foregroundStyle(transaction.isChecked ? .secondary : transaction.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        .contentShape(Rectangle())
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(
                    transaction.isChecked ? Color.progressTrack :
                        transaction.kind.color.opacity(DesignTokens.Opacity.badgeBackground)
                )
                .frame(width: 40, height: 40)

            if transaction.isChecked {
                // Show checkmark when checked
                Image(systemName: "checkmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.secondary)
            } else {
                // Show kind icon
                Image(systemName: transaction.kind.icon)
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
