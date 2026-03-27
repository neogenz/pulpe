import SwiftUI

/// Combined insights card merging top spending and budget alerts into one cohesive section
struct InsightsCard: View {
    let topSpending: CurrentMonthStore.TopSpending?
    let alerts: [BudgetAlert]
    var onTap: (() -> Void)?

    @Environment(\.amountsHidden) private var amountsHidden

    private let maxVisibleAlerts = 3

    private var hasTopSpending: Bool { topSpending != nil }
    private var hasAlerts: Bool { !alerts.isEmpty }

    private static func percentageOfTotal(_ amount: Decimal, of total: Decimal) -> Int {
        guard total > 0 else { return 0 }
        return Int(
            (amount as NSDecimalNumber)
                .dividing(by: total as NSDecimalNumber)
                .multiplying(by: 100)
                .doubleValue
        )
    }

    var body: some View {
        if hasTopSpending || hasAlerts {
            Button(
                action: { onTap?() },
                label: {
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
            )
            .buttonStyle(.plain)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvre la vue détaillée du budget")
        } else {
            Text("Enregistre tes dépenses pour voir où part ton argent")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeCard()
        }
    }

    // MARK: - Top Spending Section

    private func topSpendingSection(_ spending: CurrentMonthStore.TopSpending) -> some View {
        let percentage = Self.percentageOfTotal(spending.amount, of: spending.totalExpenses)

        return HStack(spacing: DesignTokens.Spacing.md) {
            Circle()
                .fill(Color.financialExpense.opacity(DesignTokens.Opacity.accent))
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                .overlay {
                    Image(systemName: "chart.pie.fill")
                        .font(PulpeTypography.cardTitle)
                        .foregroundStyle(Color.financialExpense)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text("Où part ton argent")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                Text(spending.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(spending.amount.asCHF)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(.primary)
                    .sensitiveAmount()
                if amountsHidden {
                    Text("Détail masqué")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                } else {
                    Text("\(percentage)% de tes dépenses")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.lg)
    }

    // MARK: - Alerts Section

    private var alertsSection: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.financialOverBudget)
                .font(PulpeTypography.subheadline)

            alertText
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
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
                // swiftlint:disable:next shorthand_operator
                result = result + Text(" · ").foregroundStyle(Color.textTertiary)
            }

            result = result + Text("\(alert.line.name) ")
                .foregroundStyle(.primary)
            + Text("\(Int(alert.consumption.percentage))%")
                .foregroundStyle(Color.financialOverBudget)
                .fontWeight(.semibold)
        }

        if alerts.count > maxVisibleAlerts {
            let remaining = alerts.count - maxVisibleAlerts
            result = result + Text(" · ").foregroundStyle(Color.textTertiary)
            + Text("et \(remaining) autres")
                .foregroundStyle(Color.textTertiary)
        }

        return result
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        var parts: [String] = []

        if let topSpending {
            let amountDescription = amountsHidden ? "Montant masqué" : topSpending.amount.asCHF
            if amountsHidden {
                parts.append("Où part ton argent: \(topSpending.name), \(amountDescription)")
            } else {
                let percentage = Self.percentageOfTotal(topSpending.amount, of: topSpending.totalExpenses)
                parts.append(
                    "Où part ton argent: \(topSpending.name), \(amountDescription), " +
                    "\(percentage) pourcent de tes dépenses"
                )
            }
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
            topSpending: CurrentMonthStore.TopSpending(name: "Courses", amount: 200, totalExpenses: 2500),
            alerts: [
                BudgetAlert(
                    line: BudgetLine(
                        id: "1", budgetId: "b1", templateLineId: nil, savingsGoalId: nil,
                        name: "Électricité", amount: 100, kind: .expense, recurrence: .fixed,
                        isManuallyAdjusted: false, checkedAt: nil, createdAt: Date(), updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 141, available: -41, percentage: 141)
                ),
                BudgetAlert(
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
            topSpending: CurrentMonthStore.TopSpending(name: "Restaurants", amount: 450, totalExpenses: 2500),
            alerts: []
        )

        // Alerts only
        InsightsCard(
            topSpending: nil,
            alerts: [
                BudgetAlert(
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

struct BudgetAlert: Sendable {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
}
