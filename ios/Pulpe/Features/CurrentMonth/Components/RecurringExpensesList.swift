import SwiftUI
import TipKit

/// Section of recurring budget lines - designed to be used inside a parent List
struct BudgetSection: View {
    let title: String
    let items: [BudgetLine]
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: (BudgetLine) -> Void
    let onDelete: (BudgetLine) -> Void
    let onAddTransaction: (BudgetLine) -> Void
    let onLongPress: (BudgetLine, [Transaction]) -> Void
    let onEdit: (BudgetLine) -> Void

    @State private var itemToDelete: BudgetLine?
    @State private var showDeleteAlert = false
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
            TipView(ProductTips.gestures)
                .listRowSeparator(.hidden)

            ForEach(Array(displayedItems.enumerated()), id: \.element.id) { index, item in
                budgetLineRow(for: item)
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if !item.isVirtualRollover {
                        Button {
                            itemToDelete = item
                            showDeleteAlert = true
                            ProductTips.gestures.invalidate(reason: .actionPerformed)
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                        .tint(.red)

                        Button {
                            onToggle(item)
                            ProductTips.gestures.invalidate(reason: .actionPerformed)
                        } label: {
                            Label(
                                item.isChecked ? "Annuler" : "Comptabiliser",
                                systemImage: item.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
                            )
                        }
                        .tint(item.isChecked ? .orange : .pulpePrimary)
                    }
                }
            }

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
        } header: {
            SectionHeader(
                title: title,
                count: items.count,
                totalAmount: totalAmount,
                totalColor: totalColor
            )
            .textCase(nil)
        }
        .alert(
            "Supprimer cette prévision ?",
            isPresented: $showDeleteAlert,
            presenting: itemToDelete
        ) { item in
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                onDelete(item)
            }
        } message: { _ in
            Text("Cette action est irréversible.")
        }
    }

    private func budgetLineRow(for item: BudgetLine) -> some View {
        BudgetLineRow(
            line: item,
            consumption: BudgetFormulas.calculateConsumption(for: item, transactions: transactions),
            allTransactions: transactions,
            isSyncing: syncingIds.contains(item.id),
            onToggle: { onToggle(item) },
            onAddTransaction: { onAddTransaction(item) },
            onLongPress: { linkedTransactions in
                onLongPress(item, linkedTransactions)
            },
            onEdit: { onEdit(item) }
        )
    }
}


/// Single budget line row - Revolut-inspired design
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let allTransactions: [Transaction]
    let isSyncing: Bool
    let onToggle: () -> Void
    let onAddTransaction: () -> Void
    let onLongPress: ([Transaction]) -> Void
    let onEdit: () -> Void

    @State private var isPressed = false
    @State private var triggerSuccessFeedback = false
    @State private var triggerWarningFeedback = false

    private var hasConsumption: Bool {
        consumption.allocated > 0
    }

    private var consumptionColor: Color {
        if consumption.isOverBudget { return .red }
        if consumption.isNearLimit { return .orange }
        return .pulpePrimary
    }

    private var remainingColor: Color {
        consumption.available < 0 ? .red : line.kind.color
    }

    private var amountTextColor: Color {
        if line.isChecked { return .secondary }
        if hasConsumption { return remainingColor }
        return line.kind.color
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
            HStack(spacing: 12) {
                // Kind icon circle (Revolut-style)
                kindIconCircle

                // Main content
                VStack(alignment: .leading, spacing: 4) {
                    Text(line.name)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(line.isChecked ? .secondary : .primary)
                        .strikethrough(line.isChecked, color: .secondary)
                        .lineLimit(1)

                    // Consumption info or recurrence label
                    if hasConsumption {
                        Text("\(consumptionPercentage)% · \(consumption.allocated.asCompactCHF) dépensé")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    } else {
                        Text(line.recurrence.label)
                            .font(.caption)
                            .foregroundStyle(Color.textTertiary)
                    }
                }

                Spacer(minLength: 8)

                // Sync indicator
                SyncIndicator(isSyncing: isSyncing)

                // Amount (remaining when transactions exist, otherwise budgeted)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(hasConsumption ? consumption.available.asCHF : line.amount.asCHF)
                        .font(.system(.callout, design: .rounded, weight: .semibold))
                        .foregroundStyle(amountTextColor)

                    if hasConsumption {
                        Text("reste")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                // Add button (only for non-rollover lines)
                if !line.isVirtualRollover {
                    Button(action: onAddTransaction) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 28, height: 28)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 8)

            // Consumption progress bar
            if hasConsumption {
                progressBar
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            guard !line.isVirtualRollover else { return }
            ProductTips.gestures.invalidate(reason: .actionPerformed)
            onEdit()
        }
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(duration: 0.25), value: isPressed)
        .onLongPressGesture(
            minimumDuration: 0.4,
            maximumDistance: 10,
            pressing: { pressing in
                withAnimation(.spring(duration: 0.2)) {
                    isPressed = pressing
                }
            },
            perform: handleLongPress
        )
        .sensoryFeedback(.success, trigger: triggerSuccessFeedback)
        .sensoryFeedback(.warning, trigger: triggerWarningFeedback)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(hasConsumption
            ? "Montant restant: \(consumption.available.asCHF). Touche pour modifier, maintiens pour voir les transactions"
            : "Touche pour modifier, maintiens pour voir les transactions"
        )
    }

    // MARK: - Kind Icon Circle (Revolut-style)

    private var kindIconCircle: some View {
        ZStack {
            Circle()
                .fill(line.isChecked ? Color.progressTrack : line.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: 40, height: 40)

            if line.isChecked {
                // Show checkmark when checked
                Image(systemName: "checkmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.secondary)
            } else {
                // Show kind icon
                Image(systemName: line.kind.listIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(line.kind.color)
            }
        }
        .opacity(line.isVirtualRollover ? 0.6 : 1)
    }

    private var progressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.progressTrack)

                Rectangle()
                    .fill(consumptionColor)
                    .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                    .animation(.spring(duration: 0.4), value: consumption.percentage)
            }
        }
        .frame(height: DesignTokens.ProgressBar.height)
        .clipShape(RoundedRectangle(cornerRadius: 1.5))
    }

    private func handleLongPress() {
        guard !line.isVirtualRollover else { return }

        ProductTips.gestures.invalidate(reason: .actionPerformed)

        if linkedTransactions.isEmpty {
            triggerWarningFeedback.toggle()
            withAnimation(.spring(duration: 0.2)) {
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
                    checkedAt: Date(),
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
                    amount: 1500,
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
    .listSectionSpacing(16)
    .scrollContentBackground(.hidden)
    .background(Color(.systemGroupedBackground))
}
