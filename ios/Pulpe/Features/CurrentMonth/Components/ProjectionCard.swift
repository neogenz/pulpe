import SwiftUI

/// Forward-looking projection card showing expected end-of-month balance
/// "À ce rythme, tu termineras le mois avec X CHF de disponible"
struct ProjectionCard: View {
    let projection: BudgetFormulas.Projection

    private var icon: String {
        switch projection.trend {
        case .onTrack: "arrow.right.circle.fill"
        case .deficit: "exclamationmark.triangle.fill"
        case .surplus: "checkmark.circle.fill"
        }
    }

    private var iconColor: Color {
        switch projection.trend {
        case .onTrack: .financialIncome
        case .deficit: .financialOverBudget
        case .surplus: .financialIncome
        }
    }

    private var message: String {
        let amount = projection.projectedEndOfMonthBalance.asCompactCHF
        if projection.projectedEndOfMonthBalance < 0 {
            return "À ce rythme, tu finiras le mois avec un déficit de \(amount)"
        }
        return "À ce rythme, tu termineras le mois avec \(amount) de disponible"
    }

    private var subMessage: String {
        let dailyRate = projection.dailySpendingRate.asCompactCHF
        return "\(dailyRate)/jour en moyenne · \(projection.daysRemaining) jours restants"
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Circle()
                .fill(iconColor.opacity(DesignTokens.Opacity.accent))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: icon)
                        .font(.system(size: 18))
                        .foregroundStyle(iconColor)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(message)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)

                Text(subMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .pulpeCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
        .accessibilityHint(subMessage)
    }
}

// MARK: - Preview

#Preview("Projection Card") {
    VStack(spacing: 16) {
        // On track
        ProjectionCard(
            projection: BudgetFormulas.Projection(
                projectedEndOfMonthBalance: 500,
                dailySpendingRate: 150,
                daysElapsed: 15,
                daysRemaining: 15,
                isOnTrack: true
            )
        )

        // Deficit
        ProjectionCard(
            projection: BudgetFormulas.Projection(
                projectedEndOfMonthBalance: -200,
                dailySpendingRate: 200,
                daysElapsed: 20,
                daysRemaining: 10,
                isOnTrack: false
            )
        )

        // Surplus
        ProjectionCard(
            projection: BudgetFormulas.Projection(
                projectedEndOfMonthBalance: 1500,
                dailySpendingRate: 100,
                daysElapsed: 10,
                daysRemaining: 20,
                isOnTrack: true
            )
        )
    }
    .padding()
    .pulpeBackground()
}
