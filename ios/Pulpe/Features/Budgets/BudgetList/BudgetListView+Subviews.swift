import SwiftUI

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    let onTap: () -> Void

    @State private var isPressed = false
    @State private var tapTrigger = false
    @State private var hasAppeared = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    private var disponibleLabel: some View {
        Text("Disponible")
            .font(PulpeTypography.inputHelper)
            .foregroundStyle(.white.opacity(0.6))
            .textCase(.uppercase)
            .tracking(0.5)
    }

    @ViewBuilder
    private var remainingAmount: some View {
        if let remaining = budget.remaining {
            Text(remaining.asSignedCompactCHF)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .sensitiveAmount()
        }
    }

    private var detailsCTA: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Détails")
                .font(PulpeTypography.buttonSecondary)
            Image(systemName: "chevron.right")
                .font(PulpeTypography.detailLabel)
        }
        .foregroundStyle(.white.opacity(0.8))
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                HStack(spacing: 6) {
                    Image(systemName: "calendar")
                        .font(PulpeTypography.metricLabel)
                    Text("Ce mois-ci")
                        .font(PulpeTypography.labelLarge)
                }
                .foregroundStyle(.white.opacity(0.7))
                VStack(alignment: .leading, spacing: 4) {
                    Text(monthName)
                        .font(PulpeTypography.brandTitle)
                        .foregroundStyle(.white)

                    if let periodLabel {
                        Text(periodLabel)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }

                Spacer().frame(height: DesignTokens.Spacing.sm)
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        disponibleLabel
                        remainingAmount
                        detailsCTA
                    }
                } else {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 6) {
                            disponibleLabel
                            remainingAmount
                        }
                        Spacer()
                        detailsCTA
                    }
                }
            }
            .padding(DesignTokens.Spacing.xxl)
            .frame(minHeight: 170)
            .contentShape(Rectangle())
            .background(heroGradientBackground)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
            .overlay(alignment: .top) {
                Capsule()
                    .fill(.white.opacity(0.15))
                    .frame(height: 1)
                    .padding(.horizontal, 28)
            }
            .overlay {
                if colorScheme == .dark {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                        .stroke(.white.opacity(0.05), lineWidth: 1)
                }
            }
            .scaleEffect(isPressed ? 0.97 : 1)
            .scaleEffect(hasAppeared ? 1 : 0.96)
            .offset(y: hasAppeared ? 0 : 8)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isPressed)
            .task {
                if reduceMotion {
                    hasAppeared = true
                } else {
                    withAnimation(DesignTokens.Animation.entranceSpring) {
                        hasAppeared = true
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.impact(weight: .medium), trigger: tapTrigger)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .accessibilityLabel(
            "\(monthName), ce mois-ci, "
            + "disponible \(amountsHidden ? "masqué" : (budget.remaining?.asCHF ?? "non défini"))"
            + (budget.rollover.map { $0 != 0 ? ", report cumulé \(amountsHidden ? "masqué" : $0.asCHF)" : "" } ?? "")
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    /// SOT with HeroBalanceCard.cardBackground — 3-state gradient crossfade + decorative circles
    private var heroGradientBackground: some View {
        ZStack {
            LinearGradient(
                colors: Color.heroGradientComfortable,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(budget.emotionState == .comfortable ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientTight,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(budget.emotionState == .tight ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientDeficit,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(budget.emotionState == .deficit ? 1 : 0)

            Circle()
                .fill(.white.opacity(0.07))
                .frame(width: 180, height: 180)
                .blur(radius: 40)
                .offset(x: 80, y: 60)

            Circle()
                .fill(.white.opacity(0.05))
                .frame(width: 120, height: 120)
                .blur(radius: 28)
                .offset(x: 60, y: -40)

            Circle()
                .fill(.white.opacity(0.03))
                .frame(width: 80, height: 80)
                .blur(radius: 24)
                .offset(x: -50, y: 0)
        }
        .animation(reduceMotion ? nil : .spring(response: 0.7, dampingFraction: 0.8), value: budget.emotionState)
        .allowsHitTesting(false)
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
                    VStack(alignment: .trailing, spacing: 2) {
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
                            .tracking(1)
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
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Ton mois\nt'attend")
                            .font(PulpeTypography.detailLabel)
                            .foregroundStyle(Color.secondary.opacity(DesignTokens.Opacity.heavy))
                            .multilineTextAlignment(.trailing)
                        Text("Action\nrequise")
                            .font(PulpeTypography.metricMini)
                            .foregroundStyle(Color.financialIncome)
                            .textCase(.uppercase)
                            .tracking(1)
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
