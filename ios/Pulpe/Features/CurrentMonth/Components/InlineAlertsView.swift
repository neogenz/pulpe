import SwiftUI

/// Inline compact alerts view showing budget lines at or above 80% consumption
struct InlineAlertsView: View {
    let alerts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    var onTap: (() -> Void)?

    private let maxVisibleAlerts = 3

    var body: some View {
        if !alerts.isEmpty {
            Button(action: { onTap?() }) {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.subheadline)

                    alertText
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvre la vue détaillée du budget")
        }
    }

    // MARK: - Alert Text

    private var alertText: Text {
        let visibleAlerts = Array(alerts.prefix(maxVisibleAlerts))

        var result = Text("")

        for (index, alert) in visibleAlerts.enumerated() {
            let color: Color = alert.consumption.isOverBudget ? .red : .orange
            let percentage = Int(alert.consumption.percentage)

            if index > 0 {
                result = result + Text(" · ").foregroundStyle(.tertiary)
            }

            result = result + Text("\(alert.line.name) ")
                .foregroundStyle(.primary)
            + Text("\(percentage)%")
                .foregroundStyle(color)
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

    private var accessibilityDescription: String {
        let descriptions = alerts.prefix(maxVisibleAlerts).map { alert in
            "\(alert.line.name) à \(Int(alert.consumption.percentage)) pourcent"
        }
        var text = "Alertes budget: " + descriptions.joined(separator: ", ")
        if alerts.count > maxVisibleAlerts {
            text += " et \(alerts.count - maxVisibleAlerts) autres"
        }
        return text
    }
}

// MARK: - Preview

#Preview("Inline Alerts") {
    VStack(spacing: 16) {
        // Multiple alerts
        InlineAlertsView(
            alerts: [
                (
                    line: BudgetLine(
                        id: "1",
                        budgetId: "b1",
                        templateLineId: nil,
                        savingsGoalId: nil,
                        name: "Courses",
                        amount: 500,
                        kind: .expense,
                        recurrence: .fixed,
                        isManuallyAdjusted: false,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 460, available: 40, percentage: 92)
                ),
                (
                    line: BudgetLine(
                        id: "2",
                        budgetId: "b1",
                        templateLineId: nil,
                        savingsGoalId: nil,
                        name: "Netflix",
                        amount: 20,
                        kind: .expense,
                        recurrence: .fixed,
                        isManuallyAdjusted: false,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 20, available: 0, percentage: 100)
                )
            ]
        )

        // Single alert
        InlineAlertsView(
            alerts: [
                (
                    line: BudgetLine(
                        id: "1",
                        budgetId: "b1",
                        templateLineId: nil,
                        savingsGoalId: nil,
                        name: "Restaurant",
                        amount: 200,
                        kind: .expense,
                        recurrence: .oneOff,
                        isManuallyAdjusted: false,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    ),
                    consumption: BudgetFormulas.Consumption(allocated: 180, available: 20, percentage: 90)
                )
            ]
        )

        // Empty (should not render)
        InlineAlertsView(alerts: [])
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
