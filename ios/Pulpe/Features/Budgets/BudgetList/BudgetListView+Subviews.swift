import SwiftUI

// MARK: - Current Month Hero Card

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                // Badge
                Text("Mois actuel")
                    .font(PulpeTypography.metricMini)
                    .fontWeight(.heavy)
                    .foregroundStyle(Color.textOnPrimary)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercaseWide)
                    .padding(.horizontal, DesignTokens.Spacing.sm)
                    .padding(.vertical, DesignTokens.Spacing.xxs)
                    .background(Color.pulpePrimary, in: Capsule())

                // Content row
                HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text(monthName)
                            .font(PulpeTypography.amountCard)
                            .foregroundStyle(.primary)
                        Text(Formatters.monthSubtitle(
                                for: budget.month ?? 0,
                                isPositive: budget.emotionState == .comfortable
                            ))
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.secondary)
                    }
                    Spacer()
                    BudgetAmountBlock(
                        remaining: budget.remaining,
                        emotionColor: budget.emotionState.color
                    )
                }
            }
            .padding(DesignTokens.Spacing.xxl)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .shadow(DesignTokens.Shadow.subtle)
        .sensoryFeedback(.impact(weight: .medium), trigger: tapTrigger)
        .accessibilityLabel(
            "\(monthName), mois actuel, "
            + (amountsHidden ? "montant masqué" : "disponible \(budget.remaining?.asCompactCHF ?? "non défini")")
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Budget Month Card

struct BudgetMonthCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    var isPast: Bool = false
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(monthName)
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(isPast ? .secondary : .primary)
                    Text(Formatters.monthSubtitle(
                                for: budget.month ?? 0,
                                isPositive: budget.emotionState == .comfortable
                            ))
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.secondary)
                }
                Spacer()
                BudgetAmountBlock(
                    remaining: budget.remaining,
                    emotionColor: budget.emotionState.color,
                    isPast: isPast
                )
            }
            .padding(DesignTokens.Spacing.xxl)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .shadow(DesignTokens.Shadow.subtle)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(
            "\(monthName), "
            + (amountsHidden ? "montant masqué" : "disponible \(budget.remaining?.asCompactCHF ?? "non défini")")
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Budget Amount Block (shared)

struct BudgetAmountBlock: View {
    let remaining: Decimal?
    let emotionColor: Color
    var isPast: Bool = false

    private var amountLabel: String {
        guard let remaining else { return "Potentiel" }
        return remaining >= 0 ? "Potentiel" : "Ajustement"
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if let remaining {
                Text(remaining.asSignedCompactCHF)
                    .font(PulpeTypography.amountXL)
                    .monospacedDigit()
                    .foregroundStyle(isPast ? .secondary : emotionColor)
                    .sensitiveAmount()
                Text(amountLabel)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(isPast ? Color.textTertiary : emotionColor)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercaseWide)
            }
        }
    }
}

// MARK: - Next Month Placeholder

struct NextMonthPlaceholder: View {
    let month: Int
    let year: Int
    var adjustment: Decimal?
    let onTap: () -> Void

    @State private var tapTrigger = false

    private var monthName: String {
        Formatters.monthName(for: month)
    }

    private var isNegative: Bool {
        guard let adjustment else { return false }
        return adjustment < 0
    }

    private var adjustmentColor: Color {
        isNegative ? Color.financialExpense : Color.pulpePrimary
    }

    private var subtitle: String {
        isNegative
            ? "Tu peux encore corriger si tu y vois plus clair"
            : "Tes objectifs pour ce mois n'attendent que toi."
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                headerRow
                ctaButton
            }
            .padding(DesignTokens.Spacing.xxl)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .strokeBorder(
                    adjustmentColor,
                    style: StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.medium,
                        dash: [8, 6]
                    )
                )
        }
        .shadow(DesignTokens.Shadow.subtle)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel("Créer un budget pour \(monthName)")
        .accessibilityHint("Appuie pour créer un budget")
        .accessibilityAddTraits(.isButton)
    }

    private var headerRow: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(monthName)
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(Color.textPrimary)
                Text(subtitle)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.secondary)
            }
            Spacer()
            if let adjustment, adjustment != 0 {
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                    Text(adjustment.asSignedCompactCHF)
                        .font(PulpeTypography.amountXL)
                        .monospacedDigit()
                        .foregroundStyle(adjustmentColor)
                        .sensitiveAmount()
                    Text(isNegative ? "Ajustement" : "Potentiel")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(adjustmentColor)
                        .textCase(.uppercase)
                        .tracking(DesignTokens.Tracking.uppercaseWide)
                }
            }
        }
    }

    private var ctaButton: some View {
        HStack {
            Text("Créer mon budget")
                .font(PulpeTypography.labelLargeBold)
                .textCase(.uppercase)
                .tracking(DesignTokens.Tracking.uppercaseNarrow)
            Spacer()
            Image(systemName: "sparkles")
                .font(PulpeTypography.detailLabel)
        }
        .foregroundStyle(Color.textOnPrimary)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.pulpePrimary, in: Capsule())
    }
}
