import SwiftUI

/// Revolut-style hero card displaying the available balance prominently
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var daysRemaining: Int? = nil
    var dailyBudget: Decimal? = nil
    var applyGlass: Bool = true
    let onTapProgress: () -> Void

    // MARK: - Computed Properties

    private var progressPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var displayPercentage: Int {
        Int(metrics.usagePercentage)
    }

    private var progressColor: Color {
        if metrics.isDeficit { return .financialOverBudget }
        if progressPercentage >= 0.80 { return .orange }
        return .pulpePrimary
    }

    private var balanceColor: Color {
        metrics.isDeficit ? .financialOverBudget : .primary
    }

    // MARK: - Body

    var body: some View {
        let content = VStack(spacing: DesignTokens.Spacing.xl) {
            // Main balance section
            balanceSection

            // Quick stats row
            statsRow
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.xxl)

        if applyGlass {
            content.pulpeHeroGlass()
        } else {
            content
        }
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.xxl) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Disponible")
                    .font(.callout.weight(.medium))
                    .foregroundStyle(.secondary)

                Text(metrics.remaining.formatted(.number.precision(.fractionLength(0...2)).locale(Locale(identifier: "de_CH"))))
                    .font(.system(size: 40, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(balanceColor)
                    .contentTransition(.numericText())
                    .accessibilityLabel(metrics.remaining.asCHF)

                if metrics.isDeficit {
                    Label("Budget dépassé", systemImage: "info.circle.fill")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.financialOverBudget)
                } else if let days = daysRemaining, let daily = dailyBudget, daily > 0 {
                    Text("\(days) jours · ~\(daily.asCompactCHF)/jour")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            progressIndicator
        }
    }

    // MARK: - Progress Indicator

    private var progressIndicator: some View {
        Button(action: onTapProgress) {
            ZStack {
                Circle()
                    .stroke(Color.progressTrack, lineWidth: 10)

                Circle()
                    .trim(from: 0, to: CGFloat(progressPercentage))
                    .stroke(
                        progressColor.gradient,
                        style: StrokeStyle(lineWidth: 10, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.6), value: progressPercentage)

                VStack(spacing: 0) {
                    Text("\(displayPercentage)")
                        .font(.system(.title2, design: .rounded, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(progressColor)
                        .contentTransition(.numericText())
                    Text("%")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 88, height: 88)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voir le détail des dépenses")
        .accessibilityValue("\(displayPercentage) pourcent du budget utilisé")
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(
                label: "Dépenses",
                value: metrics.totalExpenses,
                color: .financialExpense
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, DesignTokens.Spacing.sm)

            statItem(
                label: "Revenus",
                value: metrics.totalIncome,
                color: .financialIncome
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, DesignTokens.Spacing.sm)

            statItem(
                label: "Épargne",
                value: metrics.totalSavings,
                color: .financialSavings
            )
        }
    }

    private func statItem(label: String, value: Decimal, color: Color) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(Color.textTertiary)

            Text(value.formatted(.number.locale(Locale(identifier: "de_CH"))))
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .foregroundStyle(color)
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value.asCHF)")
    }
}

// MARK: - Preview

#Preview("Hero Balance Card") {
    ScrollView {
        VStack(spacing: 24) {
            // Normal state
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 5000,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 3000.45,
                    rollover: 500
                ),
                daysRemaining: 15,
                dailyBudget: 200,
                onTapProgress: {}
            )

            // High usage
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 4500,
                    totalSavings: 300,
                    available: 5000,
                    endingBalance: 500,
                    remaining: 200,
                    rollover: 0
                ),
                daysRemaining: 8,
                dailyBudget: 25,
                onTapProgress: {}
            )

            // Over budget
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 50000,
                    totalExpenses: 55000,
                    totalSavings: 2000,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -700,
                    rollover: 0
                ),
                daysRemaining: 20,
                dailyBudget: 0,
                onTapProgress: {}
            )
        }
        .padding()
    }
    .pulpeBackground()
}
