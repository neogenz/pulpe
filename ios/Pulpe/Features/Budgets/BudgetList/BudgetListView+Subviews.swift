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

    /// SOT — delegates to BudgetFormulas shared logic (same as HeroBalanceCard)
    private var emotionState: BudgetFormulas.EmotionState {
        BudgetFormulas.emotionState(
            remaining: budget.remaining,
            totalIncome: budget.totalIncome,
            totalExpenses: budget.totalExpenses,
            rollover: budget.rollover
        )
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
            Text(remaining.asCHF)
                .font(PulpeTypography.amountLarge)
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
            .opacity(emotionState == .comfortable ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientTight,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(emotionState == .tight ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientDeficit,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(emotionState == .deficit ? 1 : 0)

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
        .animation(reduceMotion ? nil : .spring(response: 0.7, dampingFraction: 0.8), value: emotionState)
        .allowsHitTesting(false)
    }
}

struct BudgetMonthRow: View {
    let budget: BudgetSparse
    var periodLabel: String?
    var payDayOfMonth: Int?
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        Formatters.monthName(for: budget.month ?? 0)
    }

    private var isPast: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
        return year < current.year || (year == current.year && month < current.month)
    }

    private func amountColor(isPast: Bool) -> Color {
        if isPast { return .secondary }
        guard let remaining = budget.remaining else { return .secondary }
        if remaining < 0 { return .financialOverBudget }
        if remaining > 0 { return .financialSavings }
        return .secondary
    }

    private var stateDotColor: Color? {
        guard let remaining = budget.remaining else { return nil }
        return remaining < 0 ? .financialOverBudget : .pulpePrimary
    }

    var body: some View {
        let isPast = isPast
        let color = amountColor(isPast: isPast)

        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                if let dotColor = stateDotColor {
                    Circle()
                        .fill(dotColor)
                        .frame(width: 6, height: 6)
                }
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text(monthName)
                            .font(isPast ? PulpeTypography.body : PulpeTypography.onboardingSubtitle)
                            .foregroundStyle(isPast ? .secondary : .primary)

                        if let periodLabel {
                            Text(periodLabel)
                                .font(PulpeTypography.caption)
                                .foregroundStyle(.tertiary)
                        }

                        if let remaining = budget.remaining {
                            Text(remaining.asCompactCHF)
                                .font(PulpeTypography.amountMedium)
                                .monospacedDigit()
                                .foregroundStyle(color)
                                .sensitiveAmount()
                        }
                    }

                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(monthName)
                            .font(isPast ? PulpeTypography.body : PulpeTypography.onboardingSubtitle)
                            .foregroundStyle(isPast ? .secondary : .primary)
                        if let periodLabel {
                            Text(periodLabel)
                                .font(PulpeTypography.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    if let remaining = budget.remaining {
                        Text(remaining.asCompactCHF)
                            .font(PulpeTypography.amountMedium)
                            .monospacedDigit()
                            .foregroundStyle(color)
                            .sensitiveAmount()
                    }
                }

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.detailLabel)
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(
            "\(monthName), disponible "
            + "\(amountsHidden ? "masqué" : (budget.remaining?.asCompactCHF ?? "non défini"))"
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
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
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(monthName)
                        .font(PulpeTypography.onboardingSubtitle)
                        .foregroundStyle(.tertiary)

                    Text("Pas encore de budget")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.tertiary)
                }

                Spacer()
                HStack(spacing: DesignTokens.Spacing.xs) {
                    Image(systemName: "plus")
                        .font(PulpeTypography.detailLabelBold)
                    Text("Créer")
                        .font(PulpeTypography.labelLarge)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.vertical, DesignTokens.Spacing.sm)
                .background(Color.pulpePrimary, in: Capsule())
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
            .background(
                Color(light: Color.surfaceContainerLow.opacity(0.4), dark: Color.surfaceContainerLow.opacity(0.5))
            )
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg)
                    .strokeBorder(
                        Color.outlineVariant.opacity(0.3),
                        style: StrokeStyle(lineWidth: 1, dash: [8, 4])
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel("Créer un budget pour \(monthName)")
        .accessibilityHint("Appuie pour créer un budget")
        .accessibilityAddTraits(.isButton)
    }
}
