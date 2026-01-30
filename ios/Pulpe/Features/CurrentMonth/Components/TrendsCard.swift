import SwiftUI
import Charts

/// Card showing expense trends over the last 3 months with sparkline
struct TrendsCard: View {
    let expenses: [MonthlyExpense]
    let variation: ExpenseVariation?
    let currentMonthTotal: Decimal

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            // Content
            HStack(alignment: .center, spacing: DesignTokens.Spacing.xl) {
                // Current month amount
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(currentMonthTotal.asCHF)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(.primary)

                    if let variation = variation {
                        variationLabel(variation)
                    }
                }

                Spacer()

                // Sparkline with month labels
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xs) {
                    // Month labels above chart
                    HStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(expenses) { expense in
                            Text(expense.shortMonthName)
                                .font(.caption)
                                .foregroundStyle(expense.isCurrentMonth ? .primary : .secondary)
                                .fontWeight(expense.isCurrentMonth ? .semibold : .regular)
                        }
                    }

                    // Sparkline chart
                    if expenses.count >= 2 {
                        sparklineChart
                            .frame(width: 80, height: 40)
                            .accessibilityLabel("Graphique de tendance des dépenses")
                            .accessibilityValue(sparklineAccessibilityValue)
                    } else {
                        emptySparkline
                            .frame(width: 80, height: 40)
                            .accessibilityLabel("Pas assez de données pour afficher le graphique")
                    }
                }
            }
        }
        .pulpeCard()
    }

    // MARK: - Sparkline Chart

    private var sparklineChart: some View {
        Chart(expenses) { expense in
            LineMark(
                x: .value("Mois", expense.shortMonthName),
                y: .value("Dépenses", (expense.total as NSDecimalNumber).doubleValue)
            )
            .foregroundStyle(Color.pulpePrimary)
            .interpolationMethod(.monotone)

            AreaMark(
                x: .value("Mois", expense.shortMonthName),
                y: .value("Dépenses", (expense.total as NSDecimalNumber).doubleValue)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [Color.pulpePrimary.opacity(0.3), Color.pulpePrimary.opacity(0.05)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.monotone)
        }
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .chartLegend(.hidden)
    }

    private var emptySparkline: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color.progressTrack)
            .overlay {
                Text("—")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
    }

    // MARK: - Variation Label

    @ViewBuilder
    private func variationLabel(_ variation: ExpenseVariation) -> some View {
        HStack(spacing: 2) {
            Image(systemName: variation.isIncrease ? "arrow.up.right" : "arrow.down.right")
                .font(.caption2)
                .accessibilityHidden(true)

            Text("\(variation.formattedPercentage) vs \(variation.previousMonthName)")
                .font(.caption)
        }
        .foregroundStyle(variation.isIncrease ? Color.financialOverBudget : Color.financialSavings)
        .accessibilityLabel(variation.isIncrease ? "Dépenses en hausse" : "Dépenses en baisse")
        .accessibilityValue("\(variation.formattedPercentage) par rapport à \(variation.previousMonthName)")
    }

    // MARK: - Accessibility

    private var sparklineAccessibilityValue: String {
        expenses.map { "\($0.shortMonthName): \($0.total.asCompactCHF)" }.joined(separator: ", ")
    }
}

// MARK: - Empty State

struct TrendsEmptyState: View {
    var body: some View {
        Text("Crée plus de budgets pour voir les tendances")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .pulpeCard()
    }
}

// MARK: - Preview

#Preview("Trends Card") {
    VStack(spacing: 16) {
        // With data
        TrendsCard(
            expenses: [
                MonthlyExpense(month: 12, year: 2025, total: 3800, isCurrentMonth: false),
                MonthlyExpense(month: 1, year: 2026, total: 3500, isCurrentMonth: false),
                MonthlyExpense(month: 2, year: 2026, total: 4200, isCurrentMonth: true)
            ],
            variation: ExpenseVariation(
                amount: 700,
                percentage: 20,
                previousMonth: 1,
                previousYear: 2026
            ),
            currentMonthTotal: 4200
        )

        // Decrease
        TrendsCard(
            expenses: [
                MonthlyExpense(month: 12, year: 2025, total: 4500, isCurrentMonth: false),
                MonthlyExpense(month: 1, year: 2026, total: 4200, isCurrentMonth: false),
                MonthlyExpense(month: 2, year: 2026, total: 3800, isCurrentMonth: true)
            ],
            variation: ExpenseVariation(
                amount: -400,
                percentage: -9.5,
                previousMonth: 1,
                previousYear: 2026
            ),
            currentMonthTotal: 3800
        )

        // Empty state
        TrendsEmptyState()
    }
    .padding()
    .pulpeBackground()
}
