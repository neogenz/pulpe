import SwiftUI

/// Dashboard card listing unchecked budget lines for quick reconciliation.
/// Parent controls visibility — this card has no empty state.
struct UncheckedForecastsCard: View {
    let budgetLines: [BudgetLine]
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: (BudgetLine) -> Void
    let onViewAll: () -> Void

    @State private var viewAllTrigger = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(spacing: 0) {
                ForEach(Array(budgetLines.enumerated()), id: \.element.id) { index, line in
                    UncheckedForecastRow(
                        line: line,
                        consumption: BudgetFormulas.calculateConsumption(for: line, transactions: transactions),
                        isSyncing: syncingIds.contains(line.id),
                        onToggle: { onToggle(line) }
                    )

                    if index < budgetLines.count - 1 {
                        Divider()
                            .padding(.leading, 40 + DesignTokens.Spacing.md)
                    }
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
                        .foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.selection, trigger: viewAllTrigger)
        }
        .pulpeCard()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prévisions à pointer, \(budgetLines.count) lignes")
    }
}

// MARK: - Row

private struct UncheckedForecastRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let isSyncing: Bool
    let onToggle: () -> Void

    @Environment(\.amountsHidden) private var amountsHidden
    @State private var triggerFeedback = false

    private var consumptionPercentage: Int {
        Int(min(consumption.percentage, 999))
    }

    private var consumptionColor: Color {
        guard line.kind == .expense else { return .secondary }
        if consumption.isOverBudget { return .financialOverBudget }
        if consumption.isNearLimit { return .warningPrimary }
        return .secondary
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Checkbox circle — sole toggle target
            Button {
                triggerFeedback.toggle()
                onToggle()
            } label: {
                Circle()
                    .strokeBorder(line.kind.color.opacity(0.4), lineWidth: 2)
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: line.kind.icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(line.kind.color)
                    }
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: triggerFeedback)
            .accessibilityLabel("Pointer \(line.name)")

            // Name + consumption or recurrence
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(line.name)
                    .font(.system(.body, weight: .semibold))
                    .lineLimit(1)

                if line.kind == .expense, consumption.allocated > 0 {
                    Text("\(consumptionPercentage)% \u{00B7} \(consumption.available.asAmount) restant")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(consumptionColor)
                        .sensitiveAmount()
                } else {
                    Text(line.recurrence.label)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: 8)

            SyncIndicator(isSyncing: isSyncing)

            Text(line.amount.asSignedAmount(for: line.kind))
                .font(.system(.callout, weight: .regular))
                .foregroundStyle(line.kind.color)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Empty State

/// Shown when all budget lines are checked — parent controls visibility
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
            budgetLines: [
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
                )
            ],
            transactions: [],
            syncingIds: ["1"],
            onToggle: { _ in },
            onViewAll: {}
        )
        UncheckedForecastsEmptyState()
    }
    .padding()
    .pulpeBackground()
}
