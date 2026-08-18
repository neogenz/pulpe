import SwiftUI

/// One whole-sentence key per variant: "disponible non défini" is a sentence, not
/// "disponible" glued to "non défini" — word order and agreement differ per language.
private func availabilityLabel(
    remaining: Decimal?,
    amountsHidden: Bool,
    currency: SupportedCurrency
) -> String {
    if amountsHidden { return AppLocale.string("montant masqué") }
    guard let remaining else { return AppLocale.string("disponible non défini") }
    return AppLocale.string("disponible \(remaining.rounded(2).asAdaptiveCurrency(currency))")
}

// MARK: - Current Month Hero Card

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

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
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
        .shadow(DesignTokens.Shadow.subtle)
        // A hero card at 32pt, not a row card at 18pt: it takes the border alone
        // rather than `pulpeRowCard()`, which would impose the row radius.
        .pulpeCardBorder(cornerRadius: DesignTokens.CornerRadius.xl)
        .sensoryFeedback(.impact(weight: .medium), trigger: tapTrigger)
        .accessibilityLabel(
            AppLocale.string("\(monthName), mois actuel")
            + ", "
            + availabilityLabel(
                remaining: budget.remaining,
                amountsHidden: amountsHidden,
                currency: userSettingsStore.currency
            )
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("budgetCard-\(budget.id)")
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
    @Environment(UserSettingsStore.self) private var userSettingsStore

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
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
        .shadow(DesignTokens.Shadow.subtle)
        .pulpeCardBorder(cornerRadius: DesignTokens.CornerRadius.xl)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(
            "\(monthName), "
            + availabilityLabel(
                remaining: budget.remaining,
                amountsHidden: amountsHidden,
                currency: userSettingsStore.currency
            )
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("budgetCard-\(budget.id)")
    }
}

// MARK: - Budget Amount Block (shared)

struct BudgetAmountBlock: View {
    let remaining: Decimal?
    let emotionColor: Color
    var isPast: Bool = false

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var roundedRemaining: Decimal { (remaining ?? 0).rounded(2) }

    private var amountLabel: String {
        roundedRemaining >= 0 ? AppLocale.string("Potentiel") : AppLocale.string("Ajustement")
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            if let remaining {
                let amount = remaining.rounded(2)
                Text("\(amount > 0 ? "+" : "")\(amount.asAdaptiveCurrency(userSettingsStore.currency))")
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
    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var monthName: String {
        Formatters.monthName(for: month)
    }

    private var isNegative: Bool {
        guard let adjustment else { return false }
        return adjustment.rounded(2) < 0
    }

    private var adjustmentColor: Color {
        isNegative ? Color.financialExpense : Color.pulpePrimary
    }

    private var subtitle: String {
        isNegative
            ? AppLocale.string("Tu peux encore corriger si tu y vois plus clair")
            : AppLocale.string("Tes objectifs pour ce mois n'attendent que toi.")
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
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl, style: .continuous)
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
            if let adjustment, adjustment.rounded(2) != 0 {
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                    let amount = adjustment.rounded(2)
                    Text("\(amount > 0 ? "+" : "")\(amount.asAdaptiveCurrency(userSettingsStore.currency))")
                        .font(PulpeTypography.amountXL)
                        .monospacedDigit()
                        .foregroundStyle(adjustmentColor)
                        .sensitiveAmount()
                    (isNegative ? Text("Ajustement") : Text("Potentiel"))
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
