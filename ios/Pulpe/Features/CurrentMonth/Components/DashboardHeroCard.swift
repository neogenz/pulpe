import SwiftUI

/// Dashboard hero card with available balance and linear progress bar
struct DashboardHeroCard: View {
    let metrics: BudgetFormulas.Metrics

    // MARK: - Computed Properties

    private var isOverBudget: Bool {
        metrics.remaining < 0
    }

    private var usagePercentage: Double {
        guard metrics.available > 0 else { return 1 }
        return ((metrics.totalExpenses / metrics.available) as NSDecimalNumber).doubleValue
    }

    private var clampedPercentage: Double {
        min(max(usagePercentage, 0), 1)
    }

    private var displayPercentage: Int {
        Int(usagePercentage * 100)
    }

    private var progressColor: Color {
        if usagePercentage >= 1 { return .financialOverBudget }
        if usagePercentage >= 0.8 { return .financialOverBudget }
        return .financialSavings
    }

    private var balanceColor: Color {
        isOverBudget ? .financialOverBudget : .primary
    }

    private var statusMessage: (text: String, color: Color, icon: String)? {
        if usagePercentage >= 1 {
            return nil // Over budget state is already clear from balance color
        }
        if usagePercentage >= 0.85 {
            return ("Attention, tu approches de ta limite", .financialOverBudget, "exclamationmark.circle.fill")
        }
        if usagePercentage < 0.7 {
            return ("Tu gères bien ce mois", .financialSavings, "checkmark.circle.fill")
        }
        return nil // 70-85%: no message
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Label
            Text("Disponible")
                .font(.caption)
                .foregroundStyle(Color.textTertiary)

            // Amount
            Text(metrics.remaining.asCHF)
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .foregroundStyle(balanceColor)
                .contentTransition(.numericText())

            // Progress bar with percentage
            HStack(spacing: DesignTokens.Spacing.md) {
                // Linear progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Track
                        Capsule()
                            .fill(Color.progressTrack)
                            .frame(height: DesignTokens.FrameHeight.progressBar)

                        // Fill
                        Capsule()
                            .fill(progressColor)
                            .frame(width: geometry.size.width * clampedPercentage, height: DesignTokens.FrameHeight.progressBar)
                            .animation(.spring(duration: 0.6), value: clampedPercentage)
                    }
                }
                .frame(height: DesignTokens.FrameHeight.progressBar)

                // Percentage text
                (Text("\(displayPercentage)%").font(PulpeTypography.progressValue) + Text(" utilisé").font(.subheadline).fontWeight(.medium))
                    .foregroundStyle(progressColor)
                    .fixedSize()
            }

            // Contextual status message
            if let status = statusMessage {
                HStack(spacing: 6) {
                    Image(systemName: status.icon)
                        .font(.subheadline)
                    Text(status.text)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .foregroundStyle(status.color)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.xl)
        .heroCardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Disponible \(metrics.remaining.asCHF), \(displayPercentage) pourcent du budget utilisé")
    }
}

// MARK: - Preview

#Preview("Dashboard Hero Card") {
    ScrollView {
        VStack(spacing: 24) {
            // Normal state (under 80%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 2340,
                    rollover: 500
                )
            )

            // Warning state (80-99%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 4200,
                    totalSavings: 300,
                    available: 5000,
                    endingBalance: 800,
                    remaining: 500,
                    rollover: 0
                )
            )

            // Over budget (≥100%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5500,
                    totalSavings: 200,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -700,
                    rollover: 0
                )
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
