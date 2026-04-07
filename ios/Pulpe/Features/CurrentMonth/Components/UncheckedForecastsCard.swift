import SwiftUI

/// Dashboard card listing unchecked items (transactions + budget lines) for quick reconciliation.
/// Parent controls visibility — this card has no empty state.
struct UncheckedForecastsCard: View {
    let items: [CurrentMonthStore.CheckableItem]
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    let onToggle: (CurrentMonthStore.CheckableItem) -> Void
    let onViewAll: () -> Void

    @State private var viewAllTrigger = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(spacing: 0) {
                ForEach(items) { item in
                    UncheckedItemRow(
                        item: item,
                        syncingBudgetLineIds: syncingBudgetLineIds,
                        syncingTransactionIds: syncingTransactionIds,
                        onToggle: { onToggle(item) }
                    )
                    .transition(.opacity)
                }
            }

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
                        .foregroundStyle(Color.textTertiary)
                }
            }
            .textLinkButtonStyle()
            .sensoryFeedback(.selection, trigger: viewAllTrigger)
        }
        .animation(DesignTokens.Animation.defaultSpring, value: items.map(\.id))
        .pulpeCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("À pointer, \(items.count) éléments")
    }
}

// MARK: - Row

private struct UncheckedItemRow: View {
    let item: CurrentMonthStore.CheckableItem
    let syncingBudgetLineIds: Set<String>
    let syncingTransactionIds: Set<String>
    let onToggle: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var triggerFeedback = false
    @State private var isChecked = false

    private var isSyncing: Bool {
        switch item {
        case .transaction(let tx, _):
            return syncingTransactionIds.contains(tx.id)
        case .budgetLine(let line, _):
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
                    .font(PulpeTypography.sectionIcon)
                    .foregroundStyle(isChecked ? Color.financialSavings : Color.secondary)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.plain)
            .frame(minWidth: DesignTokens.TapTarget.minimum, minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .sensoryFeedback(.success, trigger: triggerFeedback)
            .accessibilityLabel("Pointer \(item.name)")

            // Kind icon circle (informational)
            Circle()
                .fill(item.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                .overlay {
                    Image(systemName: item.kind.icon)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(item.kind.color)
                }

            // Name + subtitle
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(item.name)
                    .font(PulpeTypography.listRowTitle)
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
        case .transaction(let tx, _):
            Text(tx.transactionDate.relativeFormatted)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)

        case .budgetLine(let line, let consumption):
            if let consumption, line.kind == .expense, consumption.allocated > 0 {
                let pct = Int(min(consumption.percentage, 999))
                let color: Color = consumption.isOverBudget ? .financialOverBudget :
                    consumption.isNearLimit ? .warningPrimary : .secondary
                Text("\(pct)% \u{00B7} \(consumption.available.asAmount) restant")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(color)
                    .sensitiveAmount()
            } else if line.kind == .expense {
                Text("\(line.recurrence.label) \u{00B7} sur \(line.amount.asCompactCHF)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            } else {
                Text(line.recurrence.label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

    // MARK: - Amount

    @ViewBuilder
    private var amountText: some View {
        switch item {
        case .transaction(let tx, _):
            Text(tx.amount.asSignedAmount(for: tx.kind))
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(tx.kind.color)
                .sensitiveAmount()

        case .budgetLine(let line, let consumption):
            if line.kind == .expense, let consumption {
                let text = consumption.available.asSignedAmount(for: line.kind)
                let color: Color = consumption.isOverBudget ? .financialOverBudget :
                    consumption.isNearLimit ? .warningPrimary : .secondary
                Text(text)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(color)
                    .sensitiveAmount()
            } else {
                Text(line.amount.asSignedAmount(for: line.kind))
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(line.kind.color)
                    .sensitiveAmount()
            }
        }
    }
}

// MARK: - Empty State

/// Shown when all items are checked — parent controls visibility
struct UncheckedForecastsEmptyState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hasAppeared = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(PulpeTypography.amountXL)
                .foregroundStyle(Color.financialSavings)
                .symbolEffect(.bounce, value: hasAppeared)

            Text("Tout est pointé — bien joué !")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .scaleEffect(hasAppeared ? 1.0 : 0.92)
        .opacity(hasAppeared ? 1 : 0)
        .pulpeCard()
        .task {
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(DesignTokens.Animation.gentleSpring) {
                    hasAppeared = true
                }
            }
        }
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
