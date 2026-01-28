import SwiftUI

/// Revolut-style hero card displaying the available balance prominently
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var daysRemaining: Int? = nil
    var dailyBudget: Decimal? = nil
    let onTapProgress: () -> Void

    // MARK: - Computed Properties

    private var isOverBudget: Bool {
        metrics.remaining < 0
    }

    private var expenseRatio: Double {
        guard metrics.available > 0 else { return 1 }
        return Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
    }

    private var progressPercentage: Double {
        min(max(expenseRatio, 0), 1)
    }

    private var displayPercentage: Int {
        Int(expenseRatio * 100)
    }

    private var progressColor: Color {
        if isOverBudget { return .financialOverBudget }
        if progressPercentage > 0.85 { return .financialOverBudget }
        return .pulpePrimary
    }

    private var balanceColor: Color {
        isOverBudget ? .financialOverBudget : .primary
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            // Main balance section
            balanceSection

            // Quick stats row
            statsRow
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.xxl)
        .heroCardStyle()
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Disponible CHF")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics.remaining.formatted(.number.precision(.fractionLength(0...2))))
                        .font(PulpeTypography.amountHero)
                        .foregroundStyle(balanceColor)
                        .contentTransition(.numericText())

                }

                if isOverBudget {
                    Label("Tu as dépassé ton budget — ça arrive", systemImage: "info.circle.fill")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.financialOverBudget)
                } else if let days = daysRemaining, let daily = dailyBudget, daily > 0 {
                    Text("\(days) jours restants · ~\(daily.asCompactCHF)/jour")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Circular progress indicator
            progressIndicator
        }
    }

    // MARK: - Progress Indicator

    private var progressIndicator: some View {
        Button(action: onTapProgress) {
            ZStack {
                Circle()
                    .stroke(Color.progressTrack, lineWidth: DesignTokens.ProgressBar.circularLineWidth)

                Circle()
                    .trim(from: 0, to: CGFloat(progressPercentage))
                    .stroke(progressColor, style: StrokeStyle(lineWidth: DesignTokens.ProgressBar.circularLineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.6), value: progressPercentage)

                HStack(spacing: 2) {
                    Text("\(displayPercentage)")
                        .font(PulpeTypography.progressValue)
                        .foregroundStyle(progressColor)

                    Text("%")
                        .font(PulpeTypography.progressUnit)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 64, height: 64)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voir le détail des dépenses")
        .accessibilityValue("\(displayPercentage) pourcent du budget utilisé")
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(
                label: "Dépenses CHF",
                value: metrics.totalExpenses,
                color: .financialExpense
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, DesignTokens.Spacing.sm)

            statItem(
                label: "Revenus CHF",
                value: metrics.totalIncome,
                color: .financialIncome
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, DesignTokens.Spacing.sm)

            statItem(
                label: "Épargne CHF",
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
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Hero Card Style Modifier

private struct HeroCardStyleModifier: ViewModifier {
    func body(content: Content) -> some View {
        // glassEffect is a future iOS API - using fallback styling
        // When the API becomes available, add iOS 26+ branch with glassEffect
        content
            .background(Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
            .shadow(DesignTokens.Shadow.elevated)
    }
}

extension View {
    func heroCardStyle() -> some View {
        modifier(HeroCardStyleModifier())
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
    .background(Color(.systemGroupedBackground))
}
