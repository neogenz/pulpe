import SwiftUI

/// Dashboard card listing unchecked items (transactions + budget lines) for quick reconciliation.
/// Parent controls visibility — this card has no empty state.
struct UncheckedForecastsCard: View {
    let items: [CurrentMonthStore.CheckableItem]
    let transactions: [Transaction]
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    let onToggle: (CurrentMonthStore.CheckableItem) -> Void
    let onViewAll: () -> Void

    @State private var viewAllTrigger = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    UncheckedItemRow(
                        item: item,
                        transactions: transactions,
                        syncingBudgetLineIds: syncingBudgetLineIds,
                        syncingTransactionIds: syncingTransactionIds,
                        onToggle: { onToggle(item) }
                    )
                    .transition(.opacity.combined(with: .move(edge: .leading)))

                    if index < items.count - 1 {
                        Divider()
                            .padding(.leading, 22 + 40 + DesignTokens.Spacing.md * 2)
                    }
                }
            }
            .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: items.map(\.id))

            Button {
                viewAllTrigger.toggle()
                onViewAll()
            } label: {
                HStack {
                    Text("Voir tout")
                        .font(PulpeTypography.buttonSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.selection, trigger: viewAllTrigger)
        }
        .pulpeCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("À pointer, \(items.count) éléments")
    }
}

// MARK: - Row

private struct UncheckedItemRow: View {
    let item: CurrentMonthStore.CheckableItem
    let transactions: [Transaction]
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    let onToggle: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var triggerFeedback = false
    @State private var isChecked = false

    private var isSyncing: Bool {
        switch item {
        case .transaction(let tx):
            return syncingTransactionIds.contains(tx.id)
        case .budgetLine(let line):
            return syncingBudgetLineIds.contains(line.id)
        }
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Leading checkbox — Reminders-style circle (SF Symbol)
            Button {
                guard !isChecked else { return }
                triggerFeedback.toggle()
                let animation: Animation? = reduceMotion
                    ? .easeOut(duration: DesignTokens.Animation.fast)
                    : DesignTokens.Animation.gentleSpring
                withAnimation(animation) {
                    isChecked = true
                } completion: {
                    onToggle()
                }
            } label: {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isChecked ? Color.financialSavings : Color.secondary)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: triggerFeedback)
            .accessibilityLabel("Pointer \(item.name)")

            // Kind icon circle (informational)
            Circle()
                .fill(item.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: item.kind.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(item.kind.color)
                }

            // Name + subtitle
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(item.name)
                    .font(.system(.body, weight: .semibold))
                    .strikethrough(isChecked, color: .secondary)
                    .lineLimit(1)

                subtitle
            }

            Spacer(minLength: 8)

            SyncIndicator(isSyncing: isSyncing)

            amountText
        }
        .opacity(isChecked ? 0.4 : 1)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .accessibilityElement(children: .contain)
    }

    // MARK: - Subtitle

    @ViewBuilder
    private var subtitle: some View {
        switch item {
        case .transaction(let tx):
            Text(tx.transactionDate.relativeFormatted)
                .font(PulpeTypography.caption)
                .foregroundStyle(.secondary)

        case .budgetLine(let line):
            let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
            if line.kind == .expense, consumption.allocated > 0 {
                let pct = Int(min(consumption.percentage, 999))
                let color: Color = consumption.isOverBudget ? .financialOverBudget :
                    consumption.isNearLimit ? .warningPrimary : .secondary
                Text("\(pct)% \u{00B7} \(consumption.available.asAmount) restant")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(color)
                    .sensitiveAmount()
            } else {
                Text(line.recurrence.label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Amount

    @ViewBuilder
    private var amountText: some View {
        switch item {
        case .transaction(let tx):
            Text(tx.signedAmount.asAmount)
                .font(.system(.callout, weight: .regular))
                .foregroundStyle(tx.kind.color)
                .sensitiveAmount()

        case .budgetLine(let line):
            Text(line.amount.asSignedAmount(for: line.kind))
                .font(.system(.callout, weight: .regular))
                .foregroundStyle(line.kind.color)
                .sensitiveAmount()
        }
    }
}

// MARK: - Empty State

/// Shown when all items are checked — parent controls visibility
struct UncheckedForecastsEmptyState: View {
    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 24))
                .foregroundStyle(Color.financialSavings)

            Text("Tout est pointé — bien joué !")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCard()
    }
}

// MARK: - Preview

#Preview("Unchecked Forecasts Card") {
    VStack(spacing: 16) {
        UncheckedForecastsCard(
            items: [
                .transaction(Transaction(
                    id: "t1",
                    budgetId: "b1",
                    budgetLineId: nil,
                    name: "Café",
                    amount: 5,
                    kind: .expense,
                    transactionDate: Date(),
                    category: nil,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                )),
                .budgetLine(BudgetLine(
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
                )),
                .budgetLine(BudgetLine(
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
                ))
            ],
            transactions: [],
            syncingBudgetLineIds: ["1"],
            syncingTransactionIds: [],
            onToggle: { _ in },
            onViewAll: {}
        )
        UncheckedForecastsEmptyState()
    }
    .padding()
    .pulpeBackground()
}
