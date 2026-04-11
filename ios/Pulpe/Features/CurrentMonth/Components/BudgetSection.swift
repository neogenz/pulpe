import SwiftUI
import TipKit

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
    var tip: (any Tip)?

    init(
        title: String,
        items: [BudgetLine],
        transactions: [Transaction],
        syncingIds: Set<String>,
        onToggle: ((BudgetLine) -> Void)? = nil,
        onDelete: ((BudgetLine) -> Void)? = nil,
        onAddTransaction: ((BudgetLine) -> Void)? = nil,
        onLongPress: ((BudgetLine, [Transaction]) -> Void)? = nil,
        onEdit: ((BudgetLine) -> Void)? = nil,
        tip: (any Tip)? = nil
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
        self.tip = tip
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
            if let tip {
                TipView(tip)
                    .listRowSeparator(.hidden)
            }

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
            SectionHeader(
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
                    ProductTips.gestures.invalidate(reason: .actionPerformed)
                } label: {
                    Label("Supprimer", systemImage: "trash")
                }
                .tint(Color.destructivePrimary)
            }

            if let onToggle {
                Button {
                    onToggle(item)
                    ProductTips.gestures.invalidate(reason: .actionPerformed)
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
                    ProductTips.gestures.invalidate(reason: .actionPerformed)
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

/// Single budget line row - Revolut-inspired design
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let allTransactions: [Transaction]
    let isSyncing: Bool
    let onToggle: (() -> Void)?
    let onAddTransaction: (() -> Void)?
    let onLongPress: (([Transaction]) -> Void)?
    let onEdit: (() -> Void)?

    init(
        line: BudgetLine,
        consumption: BudgetFormulas.Consumption,
        allTransactions: [Transaction],
        isSyncing: Bool,
        onToggle: (() -> Void)? = nil,
        onAddTransaction: (() -> Void)? = nil,
        onLongPress: (([Transaction]) -> Void)? = nil,
        onEdit: (() -> Void)? = nil
    ) {
        self.line = line
        self.consumption = consumption
        self.allTransactions = allTransactions
        self.isSyncing = isSyncing
        self.onToggle = onToggle
        self.onAddTransaction = onAddTransaction
        self.onLongPress = onLongPress
        self.onEdit = onEdit
    }

    @State private var isPressed = false
    @State private var triggerSuccessFeedback = false
    @State private var triggerWarningFeedback = false

    private var hasConsumption: Bool {
        consumption.allocated > 0
    }

    private var consumptionColor: Color {
        guard line.kind == .expense else { return .secondary }
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return .secondary
    }

    private var amountTextColor: Color {
        if line.isChecked { return .secondary }
        // Expenses: always state color (icon carries category)
        if line.kind == .expense {
            if consumption.isOverBudget { return .financialOverBudget }
            if consumption.isNearLimit { return .warningPrimary }
            return .secondary
        }
        // Income & savings: category color when no consumption, secondary otherwise
        if hasConsumption { return .secondary }
        return line.kind.color
    }

    private var remainingAmountText: String {
        // Income & savings: show planned amount with sign (+/-)
        guard line.kind == .expense else {
            return line.amount.asSignedAmount(for: line.kind)
        }
        // Expenses: always show with - sign (money going out)
        return consumption.available.asSignedAmount(for: line.kind)
    }

    private var linkedTransactions: [Transaction] {
        allTransactions
            .filter { $0.budgetLineId == line.id }
            .sorted { $0.transactionDate > $1.transactionDate }
    }

    private var consumptionPercentage: Int {
        Int(min(consumption.percentage, 999))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle (Revolut-style)
            kindIconCircle

            // Main content
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(line.name)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(line.isChecked ? .secondary : .primary)
                    .strikethrough(line.isChecked, color: .secondary)
                    .lineLimit(1)

                // Consumption info or recurrence label
                if hasConsumption {
                    Text("\(consumptionPercentage)% · \(consumption.allocated.asCompactCHF) dépensé")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(1)
                        .sensitiveAmount()
                    progressBar
                } else if line.kind == .expense {
                    Text("\(line.recurrence.label) · sur \(line.amount.asCompactCHF)")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                } else {
                    Text(line.recurrence.label)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Spacer(minLength: 8)

            // Sync indicator
            SyncIndicator(isSyncing: isSyncing)

            // Amount (remaining when transactions exist, otherwise budgeted)
            Text(remainingAmountText)
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(amountTextColor)
                .sensitiveAmount()
        }
        }
        .contentShape(Rectangle())
        .onLongPressGesture(
            minimumDuration: 0.4,
            maximumDistance: 10,
            pressing: { pressing in
                guard onLongPress != nil else { return }
                withAnimation(.spring(duration: DesignTokens.Animation.fast)) {
                    isPressed = pressing
                }
            },
            perform: handleLongPress
        )
        // Prefer `onTapGesture` over wrapping the row in `Button`: we need long-press + tap on the same
        // hit target without nested button semantics (VoiceOver uses `accessibilityAction` below).
        .onTapGesture {
            guard let onAddTransaction, !line.isVirtualRollover else { return }
            ProductTips.gestures.invalidate(reason: .actionPerformed)
            onAddTransaction()
        }
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(duration: DesignTokens.Animation.fast), value: isPressed)
        .sensoryFeedback(.success, trigger: triggerSuccessFeedback)
        .sensoryFeedback(.error, trigger: triggerWarningFeedback)
        .accessibilityIdentifier("budgetLineRow-\(line.id)")
        .ifLet(onAddTransaction) { view, onAdd in
            view
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { onAdd() }
                .accessibilityHint(
                    hasConsumption
                        ? "Montant restant: \(consumption.available.asCHF). " +
                          "Touche pour ajouter une transaction, maintiens pour voir les transactions"
                        : "Touche pour ajouter une transaction, maintiens pour voir les transactions"
                )
        }
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(
                    line.isChecked
                        ? Color.progressTrack
                        : line.kind.color.opacity(DesignTokens.Opacity.badgeBackground)
                )
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)

            if line.isChecked {
                // Show checkmark when checked
                Image(systemName: "checkmark")
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textSecondary)
            } else {
                // Show kind icon
                Image(systemName: line.kind.icon)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(line.kind.color)
            }
        }
        .opacity(line.isVirtualRollover ? 0.6 : 1)
    }

    private var progressBar: some View {
        ZStack {
            Rectangle()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(min(consumption.percentage / 100, 1)))
                .fill(consumptionColor)
                .animation(DesignTokens.Animation.gentleSpring, value: consumption.percentage)
        }
        .frame(height: DesignTokens.ProgressBar.height)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.progressBar))
    }

    private func handleLongPress() {
        guard let onLongPress, !line.isVirtualRollover else { return }

        ProductTips.gestures.invalidate(reason: .actionPerformed)

        if linkedTransactions.isEmpty {
            triggerWarningFeedback.toggle()
            withAnimation(.spring(duration: DesignTokens.Animation.fast)) {
                isPressed = false
            }
        } else {
            triggerSuccessFeedback.toggle()
            onLongPress(linkedTransactions)
        }
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
}
