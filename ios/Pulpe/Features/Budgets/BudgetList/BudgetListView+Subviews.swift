import SwiftUI

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    var periodLabel: String?
    let onTap: () -> Void

    @State private var isPressed = false
    @State private var isPulsing = false
    @State private var tapTrigger = false
    @State private var hasAppeared = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.amountsHidden) private var amountsHidden

    private var monthName: String {
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var isNegative: Bool {
        (budget.remaining ?? 0) < 0
    }

    private var amountColor: Color {
        isNegative ? .financialOverBudget : .financialSavings
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                HStack(alignment: .center) {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Ce mois-ci")
                            .font(PulpeTypography.labelLarge)
                    }
                    .foregroundStyle(.secondary)

                    Spacer()

                    pulseDot
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(monthName)
                        .font(PulpeTypography.brandTitle)
                        .foregroundStyle(.primary)

                    if let periodLabel {
                        Text(periodLabel)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(.tertiary)
                    }
                }

                Spacer().frame(height: DesignTokens.Spacing.sm)
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Disponible")
                            .font(PulpeTypography.inputHelper)
                            .foregroundStyle(.tertiary)
                            .textCase(.uppercase)
                            .tracking(0.5)

                        if let remaining = budget.remaining {
                            Text(remaining.asCHF)
                                .font(PulpeTypography.amountLarge)
                                .monospacedDigit()
                                .foregroundStyle(amountColor)
                                .contentTransition(.numericText())
                                .sensitiveAmount()
                        }

                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Text("Détails")
                                .font(PulpeTypography.buttonSecondary)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(Color.pulpePrimary)
                    }
                } else {
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Disponible")
                                .font(PulpeTypography.inputHelper)
                                .foregroundStyle(.tertiary)
                                .textCase(.uppercase)
                                .tracking(0.5)

                            if let remaining = budget.remaining {
                                Text(remaining.asCHF)
                                    .font(PulpeTypography.amountLarge)
                                    .monospacedDigit()
                                    .foregroundStyle(amountColor)
                                    .contentTransition(.numericText())
                                    .sensitiveAmount()
                            }
                        }

                        Spacer()
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Text("Détails")
                                .font(PulpeTypography.buttonSecondary)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(Color.pulpePrimary)
                    }
                }
            }
            .padding(DesignTokens.Spacing.xxl)
            .frame(minHeight: 170)
            .background(heroGradientBackground)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                    .strokeBorder(Color.outlineVariant.opacity(0.15), lineWidth: 1)
            )
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
            + "\(amountsHidden ? "Montant masqué" : (budget.remaining?.asCHF ?? "non défini")) disponible"
        )
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder
    private var heroGradientBackground: some View {
        ZStack {
            Color.surfaceContainerHigh
            LinearGradient(
                colors: [
                    Color.pulpePrimary.opacity(colorScheme == .dark ? 0.12 : 0.10),
                    Color.pulpePrimary.opacity(colorScheme == .dark ? 0.04 : 0.03)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var pulseDot: some View {
        ZStack {
            if reduceMotion {
                Circle()
                    .fill(Color.pulpePrimary.opacity(0.3))
                    .frame(width: 14, height: 14)
            } else {
                Circle()
                    .fill(Color.pulpePrimary.opacity(isPulsing ? 0 : 0.35))
                    .frame(width: 10, height: 10)
                    .scaleEffect(isPulsing ? 2.0 : 1)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: isPulsing)
            }

            Circle()
                .fill(Color.pulpePrimary)
                .frame(width: 10, height: 10)
        }
        .onAppear {
            if !reduceMotion {
                isPulsing = true
            }
        }
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
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var isPastMonth: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
        return year < current.year || (year == current.year && month < current.month)
    }

    private var isFutureMonth: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        let current = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
        return year > current.year || (year == current.year && month > current.month)
    }

    private var amountColor: Color {
        if isPastMonth { return .secondary }
        if isFutureMonth { return .secondary }
        guard let remaining = budget.remaining else { return .secondary }
        if remaining < 0 { return .financialOverBudget }
        if remaining > 0 { return .financialSavings }
        return .secondary
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text(monthName)
                            .font(isPastMonth ? PulpeTypography.body : PulpeTypography.onboardingSubtitle)
                            .foregroundStyle(isPastMonth ? .secondary : .primary)

                        if let periodLabel {
                            Text(periodLabel)
                                .font(PulpeTypography.caption)
                                .foregroundStyle(.tertiary)
                        }

                        if let remaining = budget.remaining {
                            Text(remaining.asCompactCHF)
                                .font(PulpeTypography.amountMedium)
                                .monospacedDigit()
                                .foregroundStyle(amountColor)
                                .sensitiveAmount()
                        }
                    }

                    Spacer()
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(monthName)
                            .font(isPastMonth ? PulpeTypography.body : PulpeTypography.onboardingSubtitle)
                            .foregroundStyle(isPastMonth ? .secondary : .primary)
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
                            .foregroundStyle(amountColor)
                            .sensitiveAmount()
                    }
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.lg)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: tapTrigger)
        .accessibilityLabel(
            "\(monthName), solde "
            + "\(amountsHidden ? "Montant masqué" : (budget.remaining?.asCompactCHF ?? "non défini"))"
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
        guard month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
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
                        .font(.system(size: 12, weight: .bold))
                    Text("Créer")
                        .font(PulpeTypography.labelLarge)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.vertical, DesignTokens.Spacing.sm)
                .background(Color.pulpePrimary, in: Capsule())
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, 14)
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
