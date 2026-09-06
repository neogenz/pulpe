import SwiftUI

/// Section of recurring budget lines - designed to be used inside a parent List
/// Note: Deletion now uses undo toast instead of confirmation dialog
struct BudgetSection: View {
    let title: String
    let items: [BudgetLine]
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: ((BudgetLine) -> Void)?
    let onDelete: ((BudgetLine) -> Void)?
    let onAddTransaction: ((BudgetLine) -> Void)?
    let onLongPress: ((BudgetLine, [Transaction]) -> Void)?
    let onEdit: ((BudgetLine) -> Void)?

    init(
        title: String,
        items: [BudgetLine],
        transactions: [Transaction],
        syncingIds: Set<String>,
        onToggle: ((BudgetLine) -> Void)? = nil,
        onDelete: ((BudgetLine) -> Void)? = nil,
        onAddTransaction: ((BudgetLine) -> Void)? = nil,
        onLongPress: ((BudgetLine, [Transaction]) -> Void)? = nil,
        onEdit: ((BudgetLine) -> Void)? = nil
    ) {
        self.title = title
        self.items = items
        self.transactions = transactions
        self.syncingIds = syncingIds
        self.onToggle = onToggle
        self.onDelete = onDelete
        self.onAddTransaction = onAddTransaction
        self.onLongPress = onLongPress
        self.onEdit = onEdit
    }

    @State private var isExpanded = false

    private let collapsedItemCount = 3

    private var displayedItems: [BudgetLine] {
        if isExpanded || items.count <= collapsedItemCount {
            return items
        }
        return Array(items.prefix(collapsedItemCount))
    }

    private var hasMoreItems: Bool {
        items.count > collapsedItemCount
    }

    private var hiddenItemsCount: Int {
        items.count - collapsedItemCount
    }

    private var totalAmount: Decimal {
        items.reduce(0) { sum, item in
            switch item.kind {
            case .income: sum + item.amount
            case .expense, .saving: sum - item.amount
            }
        }
    }

    private var totalColor: Color {
        if totalAmount > 0 { return .financialIncome }
        if totalAmount < 0 { return .financialExpense }
        return .secondary
    }

    var body: some View {
        Section {
            ForEach(Array(displayedItems.enumerated()), id: \.element.id) { index, item in
                budgetLineRow(for: item)
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        if onToggle != nil || onDelete != nil || onEdit != nil {
                            swipeActions(for: item)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                    // Drive transitions from visible row identities (not `items.count`) so expand/collapse
                    // and reorder animate when the displayed set changes without requiring a count delta.
                    .animation(
                        .easeOut(duration: DesignTokens.Animation.normal)
                            .delay(Double(index) * 0.05),
                        value: displayedItems.map(\.id)
                    )
            }

            expandCollapseButton
        } header: {
            CountedSectionHeader(
                title: title,
                count: items.count,
                totalAmount: totalAmount,
                totalColor: totalColor
            )
            .textCase(nil)
        }
    }

    @ViewBuilder
    private func swipeActions(for item: BudgetLine) -> some View {
        if !item.isVirtualRollover {
            if let onDelete {
                Button {
                    onDelete(item)
                } label: {
                    Label("Supprimer", systemImage: "trash")
                }
                .tint(Color.destructivePrimary)
            }

            if let onToggle {
                Button {
                    onToggle(item)
                    ProductTips.checking.invalidate(reason: .actionPerformed)
                } label: {
                    Label(
                        item.isChecked ? "Dépointer" : "Pointer",
                        systemImage: item.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
                    )
                }
                .tint(item.isChecked ? Color.financialOverBudget : .pulpePrimary)
            }

            if let onEdit {
                Button {
                    onEdit(item)
                } label: {
                    Label("Modifier", systemImage: "pencil")
                }
                .tint(.editAction)
            }
        }
    }

    @ViewBuilder
    private var expandCollapseButton: some View {
        if hasMoreItems {
            Button {
                withAnimation(.easeInOut(duration: DesignTokens.Animation.fast)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(isExpanded ? "Voir moins" : "Voir plus (+\(hiddenItemsCount))")
                        .font(PulpeTypography.subheadline)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .listRowSeparator(.hidden)
        }
    }

    private func budgetLineRow(for item: BudgetLine) -> some View {
        BudgetLineRow(
            line: item,
            consumption: BudgetFormulas.calculateConsumption(for: item, transactions: transactions),
            allTransactions: transactions,
            isSyncing: syncingIds.contains(item.id),
            onToggle: onToggle.map { callback in { callback(item) } },
            onAddTransaction: onAddTransaction.map { callback in { callback(item) } },
            onLongPress: onLongPress.map { callback in { linkedTransactions in callback(item, linkedTransactions) } },
            onEdit: onEdit.map { callback in { callback(item) } }
        )
    }
}

#Preview {
    List {
        BudgetSection(
            title: "Dépenses récurrentes",
            items: [
                BudgetLine(
                    id: "1",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Loyer",
                    amount: 1500,
                    kind: .expense,
                    recurrence: .fixed,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                BudgetLine(
                    id: "2",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Salaire",
                    amount: 5000,
                    kind: .income,
                    recurrence: .fixed,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                BudgetLine(
                    id: "3",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Épargne mensuelle",
                    amount: 500,
                    kind: .saving,
                    recurrence: .fixed,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            ],
            transactions: [
                Transaction(
                    id: "t1",
                    budgetId: "b1",
                    budgetLineId: "1",
                    name: "Loyer janvier",
                    amount: 850,
                    kind: .expense,
                    transactionDate: Date(),
                    category: nil,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )
            ],
            syncingIds: ["1"],
            onToggle: { _ in },
            onDelete: { _ in },
            onAddTransaction: { _ in },
            onLongPress: { _, _ in },
            onEdit: { _ in }
        )
    }
    .listStyle(.insetGrouped)
    .listSectionSpacing(DesignTokens.Spacing.lg)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
    .environment(UserSettingsStore())
}
