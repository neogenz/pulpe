import SwiftUI

/// Card showing year-to-date savings and cumulative rollover
struct YearOverviewCard: View {
    let savingsYTD: Decimal
    let rollover: Decimal

    private var currentYear: Int {
        Calendar.current.component(.year, from: Date())
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Savings YTD
            metricCard(
                title: "Épargne \(currentYear)",
                value: savingsYTD,
                icon: TransactionKind.savingsIcon,
                color: .financialSavings
            )

            // Cumulative rollover
            metricCard(
                title: "Report cumulé",
                value: rollover,
                icon: "arrow.right.circle",
                color: rollover >= 0 ? .pulpePrimary : .financialOverBudget
            )
        }
    }

    // MARK: - Metric Card

    private func metricCard(title: String, value: Decimal, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(value.asCHF)
                .font(.system(.title3, design: .rounded, weight: .bold))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 14)
        .pulpeCardBackground()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value.asCHF)")
    }
}

// MARK: - Preview

#Preview("Year Overview Card") {
    VStack(spacing: 16) {
        YearOverviewCard(
            savingsYTD: 4200,
            rollover: 890
        )

        YearOverviewCard(
            savingsYTD: 0,
            rollover: 500
        )

        YearOverviewCard(
            savingsYTD: 2500,
            rollover: -320
        )
    }
    .padding()
    .pulpeBackground()
}
