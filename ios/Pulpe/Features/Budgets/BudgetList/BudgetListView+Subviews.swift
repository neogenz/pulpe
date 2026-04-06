import SwiftUI

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    private var emotionColor: Color {
        switch budget.emotionState {
        case .comfortable: return Color.pulpePrimary
        case .tight: return Color.financialExpense
        case .deficit: return Color.financialOverBudget
        }
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                headerRow
                metricsBar
            }
            .padding(DesignTokens.Spacing.xxl)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .stroke(
                    Color.pulpePrimary.opacity(DesignTokens.Opacity.secondary),
                    lineWidth: DesignTokens.BorderWidth.thick
                )
        }
        .shadow(DesignTokens.Shadow.elevated)
        .sensoryFeedback(.impact(weight: .medium), trigger: tapTrigger)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Mois actuel")
                    .font(PulpeTypography.metricMini)
                    .fontWeight(.heavy)
                    .foregroundStyle(Color.textOnPrimary)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercaseWide)
                    .padding(.horizontal, DesignTokens.Spacing.sm)
                    .padding(.vertical, DesignTokens.Spacing.xxs)
                    .background(Color.pulpePrimary, in: Capsule())

                Text(monthName)
                    .font(PulpeTypography.tutorialTitle)
                    .foregroundStyle(.primary)

                if let periodLabel {
                    Text(periodLabel)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.secondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                if let remaining = budget.remaining {
                    Text(remaining.asSignedCompactCHF)
                        .font(PulpeTypography.title3)
                        .monospacedDigit()
                        .foregroundStyle(emotionColor)
                        .sensitiveAmount()
                }
                Text("Disponible")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(emotionColor)
                    .textCase(.uppercase)
                    .tracking(DesignTokens.Tracking.uppercaseWide)
            }
        }
    }

    private var metricsBar: some View {
        HStack {
            innerMetric(label: "Revenus", value: budget.totalIncome)
            Spacer()
            innerMetric(label: "Dépenses", value: budget.totalExpenses)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.appBackground, in: Capsule())
    }

    private func innerMetric(label: String, value: Decimal?) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(label)
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.textTertiary)
            Text(value?.asCompactCHF ?? "–")
                .font(PulpeTypography.detailLabelBold)
                .monospacedDigit()
                .foregroundStyle(.primary)
                .sensitiveAmount()
        }
    }

    private var accessibilityDescription: String {
        let amounts = amountsHidden ? "montants masqués" :
            "revenus \(budget.totalIncome?.asCompactCHF ?? "non défini"), " +
            "dépenses \(budget.totalExpenses?.asCompactCHF ?? "non défini"), " +
            "disponible \(budget.remaining?.asCompactCHF ?? "non défini")"
        return "\(monthName), mois actuel, \(amounts)"
    }
}

struct BudgetMonthCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    var payDayOfMonth: Int?
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    private var isPast: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
        return year < current.year || (year == current.year && month < current.month)
    }

    private var emotionColor: Color {
        switch budget.emotionState {
        case .comfortable: return Color.pulpePrimary
        case .tight: return Color.financialExpense
        case .deficit: return Color.financialOverBudget
        }
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                // Top: month name + remaining amount
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text(monthName)
                            .font(PulpeTypography.tutorialTitle)
                            .foregroundStyle(isPast ? .secondary : .primary)
                        if let periodLabel {
                            Text(periodLabel)
                                .font(PulpeTypography.labelMedium)
                                .foregroundStyle(Color.secondary)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                        if let remaining = budget.remaining {
                            Text(remaining.asSignedCompactCHF)
                                .font(PulpeTypography.title3)
                                .monospacedDigit()
                                .foregroundStyle(isPast ? .secondary : emotionColor)
                                .sensitiveAmount()
                        }
                        Text("Disponible")
                            .font(PulpeTypography.metricMini)
                            .foregroundStyle(isPast ? Color.textTertiary : emotionColor)
                            .textCase(.uppercase)
                            .tracking(DesignTokens.Tracking.uppercaseWide)
                    }
                }

                // Bottom: income & expenses in subtle pill
                HStack {
                    innerMetric(label: "Revenus", value: budget.totalIncome)
                    Spacer()
                    innerMetric(label: "Dépenses", value: budget.totalExpenses)
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(Color.appBackground, in: Capsule())
            }
            .padding(DesignTokens.Spacing.xxl)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                .stroke(Color.secondary.opacity(DesignTokens.Opacity.faint), lineWidth: DesignTokens.BorderWidth.thin)
        }
        .shadow(DesignTokens.Shadow.subtle)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    private func innerMetric(label: String, value: Decimal?) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(label)
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.textTertiary)
            Text(value?.asCompactCHF ?? "–")
                .font(PulpeTypography.detailLabelBold)
                .monospacedDigit()
                .foregroundStyle(isPast ? .secondary : .primary)
                .sensitiveAmount()
        }
    }

    private var accessibilityDescription: String {
        let amounts = amountsHidden ? "montants masqués" :
            "revenus \(budget.totalIncome?.asCompactCHF ?? "non défini"), " +
            "dépenses \(budget.totalExpenses?.asCompactCHF ?? "non défini"), " +
            "disponible \(budget.remaining?.asCompactCHF ?? "non défini")"
        return "\(monthName), \(amounts)"
    }
}

struct NextMonthPlaceholder: View {
    let month: Int
    let year: Int
    let onTap: () -> Void

    @State private var tapTrigger = false

    private var monthName: String {
        Formatters.monthName(for: month)
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                // Header: title + right badge
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text("\(monthName) — Prêt à budgétiser ?")
                            .font(PulpeTypography.tutorialTitle)
                            .foregroundStyle(Color.textPrimary)
                        Text("Il est temps de poser tes bases financières.")
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                        Text("Ton mois\nt'attend")
                            .font(PulpeTypography.detailLabel)
                            .foregroundStyle(Color.secondary.opacity(DesignTokens.Opacity.heavy))
                            .multilineTextAlignment(.trailing)
                        Text("Action\nrequise")
                            .font(PulpeTypography.metricMini)
                            .foregroundStyle(Color.financialIncome)
                            .textCase(.uppercase)
                            .tracking(DesignTokens.Tracking.uppercaseWide)
                            .multilineTextAlignment(.trailing)
                    }
                }

                // Gradient CTA button
                HStack {
                    Text("Créer ton budget de \(monthName)")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(.white)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.detailLabel)
                        .foregroundStyle(.white.opacity(0.8))
                }
                .padding(DesignTokens.Spacing.lg)
                .background(
                    LinearGradient(
                        colors: Color.heroGradientComfortable,
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm)
                )
                .shadow(DesignTokens.Shadow.card)
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
                    Color.pulpePrimary.opacity(DesignTokens.Opacity.secondary),
                    style: StrokeStyle(lineWidth: DesignTokens.BorderWidth.medium, dash: [8, 6])
                )
        }
        .shadow(DesignTokens.Shadow.subtle)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel("Créer un budget pour \(monthName)")
        .accessibilityHint("Appuie pour créer un budget")
        .accessibilityAddTraits(.isButton)
    }
}
