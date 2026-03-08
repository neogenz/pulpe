import SwiftUI

/// Dashboard card listing unchecked budget lines for quick reconciliation.
/// Parent controls visibility — this card has no empty state.
struct UncheckedForecastsCard: View {
    let budgetLines: [BudgetLine]
    let transactions: [Transaction]
    let syncingIds: Set<String>
    let onToggle: (BudgetLine) -> Void
    let onViewAll: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(spacing: 0) {
                ForEach(budgetLines, id: \.id) { line in
                    UncheckedForecastRow(
                        line: line,
                        consumption: BudgetFormulas.calculateConsumption(for: line, transactions: transactions),
                        isSyncing: syncingIds.contains(line.id),
                        onToggle: { onToggle(line) }
                    )
                }
            }

            Button(action: onViewAll) {
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
        Button {
            triggerFeedback.toggle()
            onToggle()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                // Kind icon circle
                Circle()
                    .fill(line.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: line.kind.icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(line.kind.color)
                    }

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
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.success, trigger: triggerFeedback)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pointer \(line.name), \(amountsHidden ? "Montant masqu\u{00E9}" : line.amount.asCHF)")
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
