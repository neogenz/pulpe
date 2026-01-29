import SwiftUI

/// Combined insights card merging top spending and budget alerts into one cohesive section
struct InsightsCard: View {
    let topSpending: (name: String, amount: Decimal, totalExpenses: Decimal)?
    let alerts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    var onTap: (() -> Void)?

    private let maxVisibleAlerts = 3

    private var hasTopSpending: Bool { topSpending != nil }
    private var hasAlerts: Bool { !alerts.isEmpty }

    var body: some View {
        if hasTopSpending || hasAlerts {
            Button(action: { onTap?() }) {
                VStack(alignment: .leading, spacing: 0) {
                    if let topSpending {
                        topSpendingSection(topSpending)
                    }

                    if hasTopSpending && hasAlerts {
                        Divider()
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                    }

                    if hasAlerts {
                        alertsSection
                    }
                }
                .pulpeCardBackground()
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvre la vue détaillée du budget")
        } else {
            Text("Ajoute une dépense pour voir l'aperçu")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeCard()
                .accessibilityLabel("Ajoute une dépense pour voir l'aperçu")
        }
    }

    // MARK: - Top Spending Section

    private func topSpendingSection(_ spending: (name: String, amount: Decimal, totalExpenses: Decimal)) -> some View {
        let percentageOfTotal: Int = {
            guard spending.totalExpenses > 0 else { return 0 }
            return Int(((spending.amount / spending.totalExpenses * 100) as NSDecimalNumber).doubleValue)
        }()

        return HStack(spacing: DesignTokens.Spacing.md) {
            Circle()
                .fill(Color.financialExpense.opacity(DesignTokens.Opacity.accent))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: "chart.pie.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.financialExpense)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text("Où part ton argent")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(spending.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(spending.amount.asCHF)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                Text("\(percentageOfTotal)% de tes dépenses")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 14)
    }

    // MARK: - Alerts Section

    private var alertsSection: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.financialOverBudget)
                .font(.subheadline)

            alertText
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.errorBackground,
            in: UnevenRoundedRectangle(
                topLeadingRadius: hasTopSpending ? 0 : DesignTokens.CornerRadius.lg,
                bottomLeadingRadius: DesignTokens.CornerRadius.lg,
                bottomTrailingRadius: DesignTokens.CornerRadius.lg,
                topTrailingRadius: hasTopSpending ? 0 : DesignTokens.CornerRadius.lg
            )
        )
    }

    // MARK: - Alert Text

    private var alertText: Text {
        let visibleAlerts = Array(alerts.prefix(maxVisibleAlerts))

        var result = Text("")

        for (index, alert) in visibleAlerts.enumerated() {
            if index > 0 {
                result = result + Text(" · ").foregroundStyle(.tertiary)
            }

            result = result + Text("\(alert.line.name) ")
                .foregroundStyle(.primary)
            + Text("\(Int(alert.consumption.percentage))%")
                .foregroundStyle(Color.financialOverBudget)
                .fontWeight(.semibold)
        }

        if alerts.count > maxVisibleAlerts {
            let remaining = alerts.count - maxVisibleAlerts
            result = result + Text(" · ").foregroundStyle(.tertiary)
            + Text("et \(remaining) autres")
                .foregroundStyle(.tertiary)
        }

        return result
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        var parts: [String] = []

        if let topSpending {
            let percentage: Int = {
                guard topSpending.totalExpenses > 0 else { return 0 }
                return Int(((topSpending.amount / topSpending.totalExpenses * 100) as NSDecimalNumber).doubleValue)
            }()
            parts.append("Où part ton argent: \(topSpending.name), \(topSpending.amount.asCHF), \(percentage) pourcent de tes dépenses")
        }

        if hasAlerts {
            let descriptions = alerts.prefix(maxVisibleAlerts).map { alert in
                "\(alert.line.name) à \(Int(alert.consumption.percentage)) pourcent"
            }
            var alertText = "Alertes budget: " + descriptions.joined(separator: ", ")
            if alerts.count > maxVisibleAlerts {
                alertText += " et \(alerts.count - maxVisibleAlerts) autres"
            }
            parts.append(alertText)
        }

        return parts.joined(separator: ". ")
    }
}

// MARK: - Preview

#Preview("Insights Card") {
    VStack(spacing: 16) {
        // Both sections
        InsightsCard(
            topSpending: (name: "Courses", amount: 200, totalExpenses: 2500),
            alerts: [
                (
                    line: BudgetLine(
                        id: "1", budgetId: "b1", templateLineId: nil, savingsGoalId: nil,
                        name: "Électricité", amount: 100, kind: .expense, recurrence: .fixed,
                        isManuallyAdjusted: false, checkedAt: nil, createdAt: Date(), updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 141, available: -41, percentage: 141)
                ),
                (
                    line: BudgetLine(
                        id: "2", budgetId: "b1", templateLineId: nil, savingsGoalId: nil,
                        name: "Netflix", amount: 20, kind: .expense, recurrence: .fixed,
                        isManuallyAdjusted: false, checkedAt: nil, createdAt: Date(), updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 20, available: 0, percentage: 100)
                )
            ]
        )

        // Top spending only
        InsightsCard(
            topSpending: (name: "Restaurants", amount: 450, totalExpenses: 2500),
            alerts: []
        )

        // Alerts only
        InsightsCard(
            topSpending: nil,
            alerts: [
                (
                    line: BudgetLine(
                        id: "1", budgetId: "b1", templateLineId: nil, savingsGoalId: nil,
                        name: "Restaurant", amount: 200, kind: .expense, recurrence: .oneOff,
                        isManuallyAdjusted: false, checkedAt: nil, createdAt: Date(), updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 180, available: 20, percentage: 90)
                )
            ]
        )

        // Empty state
        InsightsCard(topSpending: nil, alerts: [])
    }
    .padding()
    .pulpeBackground()
}
