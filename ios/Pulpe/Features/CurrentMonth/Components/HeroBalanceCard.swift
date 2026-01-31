import SwiftUI

/// Hero card with colored gradient background + summary pills below.
/// The gradient card contains balance + progress, pills sit outside for readability.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var daysRemaining: Int? = nil
    var dailyBudget: Decimal? = nil
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

    private var heroTintColor: Color {
        metrics.isDeficit ? .financialOverBudget : .financialSavings
    }

    private var contextLabel: String {
        metrics.isDeficit ? "Déficit ce mois" : "Ce qu'il te reste ce mois"
    }

    private var motivationalMessage: String {
        if metrics.isDeficit {
            return "Ce mois sera serré — mais tu le sais"
        }
        if metrics.totalIncome > 0, metrics.remaining > metrics.totalIncome * Decimal(string: "0.2")! {
            return "Belle marge ce mois"
        }
        if metrics.remaining > 0 {
            return "Tu gères bien"
        }
        return "Pile à l'équilibre"
    }

    private var heroBackgroundStart: Color {
        metrics.isDeficit
            ? Color(light: Color(hex: 0xFDE8D8), dark: Color(hex: 0x2E1E12))
            : Color(light: Color(hex: 0xD0EDCF), dark: Color(hex: 0x162E18))
    }

    private var heroBackgroundEnd: Color {
        metrics.isDeficit
            ? Color(light: Color(hex: 0xFDF4EC), dark: Color(hex: 0x241A10))
            : Color(light: Color(hex: 0xE4F3E0), dark: Color(hex: 0x122414))
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Gradient hero card
            balanceRow
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.xl)
                .background(
                    LinearGradient(
                        colors: [heroBackgroundStart, heroBackgroundEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: .rect(cornerRadius: DesignTokens.CornerRadius.xl)
                )

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
                    .foregroundStyle(heroTintColor)

                Text(abs(metrics.remaining).formatted(
                    .number.precision(.fractionLength(0 ... 2))
                        .locale(Locale(identifier: "de_CH"))
                ))
                .font(.system(size: 40, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.primary)
                .contentTransition(.numericText())
                .accessibilityLabel(metrics.remaining.asCHF)

                Text(motivationalMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
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

    // MARK: - Pill Chips

    private var pillChips: some View {
        ScrollView(.horizontal) {
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
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
    }

    private func pillChip(icon: String, label: String, value: Decimal, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)

                Text(value.formatted(.number.locale(Locale(identifier: "de_CH"))))
                    .font(.system(.callout, design: .rounded, weight: .semibold))
                    .foregroundStyle(color)
                    .contentTransition(.numericText())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(color.opacity(0.10), in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value.asCHF)")
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
                daysRemaining: 15,
                dailyBudget: 167,
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
