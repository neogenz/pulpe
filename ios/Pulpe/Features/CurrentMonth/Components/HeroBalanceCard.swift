import SwiftUI

/// Hero card with colored gradient background + summary pills below.
/// The gradient card contains balance + progress, pills sit outside for readability.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    let onTapProgress: () -> Void

    // MARK: - Constants

    private static let twentyPercent: Decimal = 2 / 10
    
    // MARK: - Static Formatters (avoid recreation on every render)
    
    private static let balanceFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "de_CH")
        return formatter
    }()
    
    private static let pillFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "de_CH")
        return formatter
    }()

    @ScaledMetric(relativeTo: .largeTitle) private var heroFontSize: CGFloat = 40

    // MARK: - Computed Properties

    private var progressPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var displayPercentage: Int {
        Int(metrics.usagePercentage)
    }

    private var heroTintColor: Color {
        metrics.isDeficit ? .financialOverBudget : .pulpePrimary
    }

    private var contextLabel: String {
        metrics.isDeficit ? "Déficit ce mois" : "Ce qu'il te reste ce mois"
    }

    private var motivationalMessage: String {
        if metrics.isDeficit {
            return "Ce mois sera serré — mais tu le sais"
        }
        if metrics.totalIncome > 0, metrics.remaining > metrics.totalIncome * Self.twentyPercent {
            return "Belle marge ce mois"
        }
        if metrics.remaining > 0 {
            return "Tu gères bien"
        }
        return "Pile à l'équilibre"
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Vibrant glass hero card
            balanceRow
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.xl)
                .heroCardBackground(tint: heroTintColor)

            // Pills below the card
            pillChips
        }
    }

    // MARK: - Balance Row

    private var balanceRow: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.xl) {
            VStack(alignment: .leading, spacing: 6) {
                Text(contextLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)

                Text(Self.balanceFormatter.string(from: abs(metrics.remaining) as NSDecimalNumber) ?? "0")
                .font(.custom("Manrope-Bold", size: heroFontSize, relativeTo: .largeTitle))
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .sensitiveAmount()
                .accessibilityLabel(metrics.remaining.asCHF)

                Text(motivationalMessage)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.white.opacity(0.75))
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
                    .stroke(Color.white.opacity(0.25), lineWidth: 10)

                Circle()
                    .trim(from: 0, to: CGFloat(progressPercentage))
                    .stroke(
                        Color.white.gradient,
                        style: StrokeStyle(lineWidth: 10, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.6), value: progressPercentage)

                VStack(spacing: 0) {
                    Text("\(displayPercentage)")
                        .font(.custom("Manrope-Bold", size: 22, relativeTo: .title2))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                    Text("%")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.7))
                }
                .sensitiveAmount()
            }
            .frame(width: 88, height: 88)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voir le détail des dépenses")
        .accessibilityValue("\(displayPercentage) pourcent du budget utilisé")
    }

    // MARK: - Pill Chips

    private var pillChips: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            pillChip(
                icon: "arrow.up.right",
                label: "Revenus",
                value: metrics.totalIncome,
                color: .financialIncome
            )

            pillChip(
                icon: "arrow.down.right",
                label: "Dépenses",
                value: metrics.totalExpenses,
                color: .financialExpense
            )

            pillChip(
                icon: TransactionKind.savingsIcon,
                label: "Épargne",
                value: metrics.totalSavings,
                color: .financialSavings
            )
        }
    }

    private func pillChip(icon: String, label: String, value: Decimal, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.primary)

                Text(Self.pillFormatter.string(from: value as NSDecimalNumber) ?? "0")
                    .font(.custom("Manrope-SemiBold", size: 16, relativeTo: .callout))
                    .foregroundStyle(color)
                    .contentTransition(.numericText())
                    .sensitiveAmount()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(color.opacity(0.12), in: Capsule())
        .overlay(Capsule().strokeBorder(color.opacity(0.15), lineWidth: 0.5))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value.asCHF)")
    }
}

// MARK: - Hero Card Background (solid fill — glass is for navigation layer only per HIG)

private extension View {
    func heroCardBackground(tint: Color) -> some View {
        background(tint, in: .rect(cornerRadius: DesignTokens.CornerRadius.xl))
    }
}

// MARK: - Helpers

private func abs(_ value: Decimal) -> Decimal {
    value < 0 ? -value : value
}

// MARK: - Preview

#Preview("Hero Balance Card") {
    ScrollView {
        VStack(spacing: 24) {
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 2500,
                    rollover: 500
                ),
                onTapProgress: {}
            )

            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 8500,
                    totalExpenses: 8619,
                    totalSavings: 0,
                    available: 8500,
                    endingBalance: -119,
                    remaining: -119,
                    rollover: 0
                ),
                onTapProgress: {}
            )

            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5000,
                    totalSavings: 0,
                    available: 5000,
                    endingBalance: 0,
                    remaining: 0,
                    rollover: 0
                ),
                onTapProgress: {}
            )
        }
        .padding()
    }
    .pulpeBackground()
}
