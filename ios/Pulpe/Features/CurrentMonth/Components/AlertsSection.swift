import SwiftUI

/// Section showing budget lines that are at or above 80% consumption
struct AlertsSection: View {
    let alerts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    let onTapViewBudget: () -> Void

    var body: some View {
        if !alerts.isEmpty {
            Section {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    ForEach(alerts.prefix(3), id: \.line.id) { alert in
                        AlertRow(
                            name: alert.line.name,
                            percentage: Int(alert.consumption.percentage),
                            isOverBudget: alert.consumption.isOverBudget
                        )
                    }

                    if alerts.count > 3 {
                        Text("+\(alerts.count - 3) autres")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(.secondary)
                    }

                    Button(action: onTapViewBudget) {
                        Text("Voir le budget")
                            .font(PulpeTypography.subheadline)
                            .fontWeight(.medium)
                    }
                    .padding(.top, DesignTokens.Spacing.xs)
                }
                .padding(.vertical, DesignTokens.Spacing.xs)
            } header: {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Color.financialOverBudget)
                    Text("Dépenses à surveiller")
                        .font(PulpeTypography.subheadline)
                        .fontWeight(.semibold)
                }
                .textCase(nil)
            }
        }
    }
}

/// Single alert row
private struct AlertRow: View {
    let name: String
    let percentage: Int
    let isOverBudget: Bool

    private var color: Color {
        Color.financialOverBudget
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)

            Text(name)
                .font(PulpeTypography.subheadline)
                .lineLimit(1)

            Spacer()

            Text("\(percentage)%")
                .font(PulpeTypography.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(color)
        }
    }
}

#Preview {
    List {
        AlertsSection(
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
            ],
            onTapViewBudget: {}
        )
    }
    .listStyle(.insetGrouped)
}
