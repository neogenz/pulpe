import SwiftUI

/// Card showing year-to-date savings and cumulative rollover
struct YearOverviewCard: View {
    let savingsYTD: Decimal
    let rollover: Decimal

    private var currentYear: Int {
        Calendar.current.component(.year, from: Date())
    }

    var body: some View {
        HStack(spacing: 12) {
            // Savings YTD
            metricCard(
                title: "Épargne \(currentYear)",
                value: savingsYTD,
                icon: "banknote",
                color: .financialSavings
            )

            // Cumulative rollover
            metricCard(
                title: "Report cumulé",
                value: rollover,
                icon: "arrow.right.circle",
                color: rollover >= 0 ? .pulpePrimary : .red
            )
        }
    }

    // MARK: - Metric Card

    private func metricCard(title: String, value: Decimal, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text(value.asCHF)
                .font(.system(.title3, design: .rounded, weight: .semibold))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value.asCHF)")
    }
}

// MARK: - Empty State

struct YearOverviewEmptyState: View {
    private var currentYear: Int {
        Calendar.current.component(.year, from: Date())
    }

    var body: some View {
        HStack(spacing: 12) {
            emptyCard(title: "Épargne \(currentYear)", icon: "banknote")
            emptyCard(title: "Report cumulé", icon: "arrow.right.circle")
        }
    }

    private func emptyCard(title: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text("CHF 0")
                .font(.system(.title3, design: .rounded, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
    }
}

// MARK: - Preview

#Preview("Year Overview Card") {
    VStack(spacing: 16) {
        // Positive values
        YearOverviewCard(
            savingsYTD: 4200,
            rollover: 890
        )

        // Zero savings
        YearOverviewCard(
            savingsYTD: 0,
            rollover: 500
        )

        // Negative rollover
        YearOverviewCard(
            savingsYTD: 2500,
            rollover: -320
        )

        // Empty state
        YearOverviewEmptyState()
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
