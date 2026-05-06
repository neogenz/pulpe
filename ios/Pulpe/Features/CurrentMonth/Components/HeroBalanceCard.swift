// swiftlint:disable type_body_length
import SwiftUI

/// Hero balance card — contextual label, hero amount, progress + percent, and a 4-pill footer row
/// (Reporté · Revenus · Épargne · Dépenses) per DM2.1.b.c5 spec.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var timeElapsedPercentage: Double = 0
    var onTapProgress: (() -> Void)?
    var onTapChart: (() -> Void)?
    var rolloverAmount: Decimal?
    /// Localized month name of the source budget (e.g. "mars"). Drives the rollover pill label.
    var previousBudgetMonth: String?
    var onRolloverTap: (() -> Void)?

    // MARK: - Environment

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var tapTrigger = false

    // MARK: - Computed Properties

    private var contextLabel: String {
        let symbol = userSettingsStore.currency.symbol
        return metrics.isDeficit ? "Déficit \(symbol)" : "Disponible \(symbol)"
    }

    /// VoiceOver-only label — no embedded currency symbol so it isn't doubled with the formatted amount.
    private var contextLabelForVoiceOver: String {
        metrics.isDeficit ? "Déficit" : "Disponible"
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var formattedBalance: String {
        abs(metrics.remaining).asCompactAmount(for: userSettingsStore.currency)
    }

    private var usagePercentageText: String {
        "\(Int(metrics.usagePercentage))%"
    }

    private var supportingTextOpacity: Double {
        switch metrics.emotionState {
        case .tight:
            0.96
        case .comfortable, .deficit:
            0.88
        }
    }

    /// Tint color for glass overlays — matches the hero gradient per emotion state
    /// so Liquid Glass blends into the card instead of appearing white.
    private var glassTintColor: Color {
        switch metrics.emotionState {
        case .comfortable: .heroTintComfortable
        case .tight: .heroTintTight
        case .deficit: .heroTintDeficit
        }
    }

    private var hasRollover: Bool {
        guard let rolloverAmount else { return false }
        return rolloverAmount != 0
    }

    private var rolloverPillLabel: String {
        if let previousBudgetMonth, !previousBudgetMonth.isEmpty {
            return "Reporté de \(previousBudgetMonth)"
        }
        return "Reporté"
    }

    private var accessibilityDescription: String {
        if amountsHidden {
            return "\(contextLabelForVoiceOver) — montant masqué"
        }
        let currency = userSettingsStore.currency
        var desc = """
        \(contextLabelForVoiceOver) \(abs(metrics.remaining).asCurrency(currency)). \
        \(Int(metrics.usagePercentage))% utilisé. \
        Revenus \(metrics.totalIncome.asCurrency(currency)). \
        Épargne \(metrics.totalSavings.asCurrency(currency))
        """
        if let rolloverAmount, rolloverAmount != 0 {
            let label = rolloverAmount >= 0 ? "Excédent reporté" : "Déficit reporté"
            desc += ". \(label) de \(abs(rolloverAmount).asCurrency(currency))"
        }
        return desc
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let onTapProgress {
                Button {
                    tapTrigger.toggle()
                    onTapProgress()
                } label: {
                    cardContent
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            } else {
                cardContent
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityDescription)
        .accessibilityAddTraits(onTapProgress != nil ? .isButton : [])
        .ifLet(onRolloverTap) { view, action in
            view.accessibilityAction(named: "Voir le budget précédent", action)
        }
        .ifLet(onTapChart) { view, action in
            view.accessibilityAction(named: "Suivi du budget", action)
        }
    }

    // MARK: - Card Content

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Chunk 1 — Contextual label
            Text(contextLabel)
                .font(PulpeTypography.labelLargeBold)
                .textCase(.uppercase)
                .foregroundStyle(.white.opacity(supportingTextOpacity))

            // Chunk 2 — Hero amount
            Text(formattedBalance)
                .font(PulpeTypography.amountHero)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .sensitiveAmount()

            Spacer()
                .frame(height: DesignTokens.Spacing.md)

            // Chunk 3 — Progress bar with inline percent
            progressRow

            // Chunk 4 — 3-pill footer (Reporté · Revenus · Épargne)
            pillsRow
                .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { cardBackground }
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
        .overlay(alignment: .topTrailing) {
            if let onTapChart {
                chartButton(action: onTapChart)
                    .padding(DesignTokens.Spacing.md)
            }
        }
        .overlay(alignment: .top) {
            // Subtle specular highlight to keep the hero vivid without using shadows.
            Capsule()
                .fill(.white.opacity(DesignTokens.Opacity.accent))
                .frame(height: DesignTokens.FrameHeight.separator)
                .padding(.horizontal, DesignTokens.Spacing.xxl + DesignTokens.Spacing.xs)
        }
        .overlay {
            if colorScheme == .dark {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                    .stroke(.white.opacity(DesignTokens.Opacity.faint), lineWidth: DesignTokens.BorderWidth.thin)
            }
        }
        .animation(.spring(response: 0.7, dampingFraction: 0.8), value: metrics.emotionState)
    }

    // MARK: - Chart Button

    private func chartButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "chart.bar.fill")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(.white)
                .frame(
                    width: DesignTokens.TapTarget.minimum,
                    height: DesignTokens.TapTarget.minimum
                )
                .heroGlassBackground(tint: glassTintColor, shape: .circle)
        }
        .circleIconButtonStyle()
        .accessibilityLabel("Suivi du budget")
    }

    // MARK: - Progress + Inline Percent

    private var progressRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            progressBar

            Text(usagePercentageText)
                .font(PulpeTypography.progressValue)
                .foregroundStyle(.white)
                .monospacedDigit()
                .accessibilityHidden(true)
        }
    }

    // MARK: - Progress Bar with Pace Indicator

    private var progressBar: some View {
        ZStack {
            Capsule()
                .fill(.white.opacity(DesignTokens.Opacity.secondary))

            ProgressBarShape(progress: fillPercentage)
                .fill(Color.white)
                .animation(DesignTokens.Animation.smoothEaseInOut, value: fillPercentage)
        }
        .frame(height: DesignTokens.ProgressBar.heroHeight)
    }

    // MARK: - Pills Row (3-pill horizontal scroll)

    private var pillsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                if hasRollover, let rolloverAmount {
                    rolloverPill(amount: rolloverAmount)
                }

                incomePill

                savingsPill

                expensesPill
            }
            .padding(.horizontal, DesignTokens.Spacing.xxs)
        }
        .scrollClipDisabled()
    }

    // MARK: - Rollover Pill

    @ViewBuilder
    private func rolloverPill(amount: Decimal) -> some View {
        if let onRolloverTap {
            Button(action: onRolloverTap) { rolloverPillContent(amount: amount) }
                .buttonStyle(.plain)
        } else {
            rolloverPillContent(amount: amount)
        }
    }

    private func rolloverPillContent(amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: "arrow.clockwise")
                .font(PulpeTypography.metricMini)

            Text("\(rolloverPillLabel) ·")
                .font(PulpeTypography.metricLabel)
                .italic()

            Text(abs(amount).asCompactCurrency(userSettingsStore.currency))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.tightGap)
        .background {
            Capsule()
                .fill(.white.opacity(DesignTokens.Opacity.shadow))
        }
        .overlay {
            Capsule()
                .strokeBorder(
                    .white.opacity(DesignTokens.Opacity.strong),
                    style: StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [4])
                )
        }
        .contentShape(Capsule())
    }

    // MARK: - Income & Savings Pills

    private var incomePill: some View {
        tintedPill(
            prefix: "+",
            amount: metrics.totalIncome,
            tint: .financialIncome
        )
    }

    private var savingsPill: some View {
        tintedPill(
            prefix: "🐷",
            amount: metrics.totalSavings,
            tint: .financialSavings
        )
    }

    private var expensesPill: some View {
        tintedPill(
            prefix: "−",
            amount: metrics.totalExpenses,
            tint: .financialExpense
        )
    }

    /// Solid-tint pill for revenu/épargne totals — colored capsule, white text, sign/icon prefix.
    private func tintedPill(prefix: String, amount: Decimal, tint: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(prefix)
                .font(PulpeTypography.metricLabelBold)

            Text(amount.asCompactCurrency(userSettingsStore.currency))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.tightGap)
        .background {
            Capsule()
                .fill(tint.opacity(DesignTokens.Opacity.strong))
        }
        .contentShape(Capsule())
    }

    // MARK: - Card Background

    private var cardBackground: some View {
        ZStack {
            // Gradient crossfade for smooth state transitions
            LinearGradient(
                colors: Color.heroGradientComfortable,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .comfortable ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientTight,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .tight ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientDeficit,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .deficit ? 1 : 0)

            decorativeCircles
        }
    }

    // MARK: - Decorative Circles

    private var decorativeCircles: some View {
        ZStack {
            Circle()
                .fill(.white.opacity(0.07))
                .frame(width: 224, height: 224)
                .blur(radius: 48)
                .offset(x: 100, y: 80)

            Circle()
                .fill(.white.opacity(0.05))
                .frame(width: 144, height: 144)
                .blur(radius: 32)
                .offset(x: 80, y: -60)

            Circle()
                .fill(.white.opacity(0.03))
                .frame(width: 96, height: 96)
                .blur(radius: 32)
                .offset(x: -60, y: 0)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Hero Glass Background

/// Tinted interactive glass on iOS 26+, subtle white overlay fallback on older.
/// Use on elements inside the HeroBalanceCard gradient — the tint makes glass
/// blend with the card color instead of appearing flat white.
private struct HeroGlassModifier<S: Shape>: ViewModifier {
    let tint: Color
    let shape: S

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.tint(tint).interactive(), in: shape)
        } else {
            content
                .background(.white.opacity(DesignTokens.Opacity.accent), in: shape)
        }
        #else
        content
            .background(.white.opacity(DesignTokens.Opacity.accent), in: shape)
        #endif
    }
}

private extension View {
    func heroGlassBackground<S: Shape>(tint: Color, shape: S) -> some View {
        modifier(HeroGlassModifier(tint: tint, shape: shape))
    }
}

// MARK: - Preview

#Preview("Hero Balance Card — 3 States") {
    ScrollView {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            // Comfortable with rollover
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 7500,
                    totalExpenses: 3440,
                    totalSavings: 600,
                    available: 7500,
                    endingBalance: 4060,
                    remaining: 4060,
                    rollover: 0
                ),
                timeElapsedPercentage: 50,
                rolloverAmount: 4060,
                previousBudgetMonth: "mars",
                onRolloverTap: {}
            )

            // Tight: 80-100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 4300,
                    totalExpenses: 3800,
                    totalSavings: 200,
                    available: 4300,
                    endingBalance: 500,
                    remaining: 500,
                    rollover: 0
                ),
                timeElapsedPercentage: 65
            )

            // Deficit with negative rollover
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 4121,
                    totalExpenses: 5351,
                    totalSavings: 0,
                    available: 4121,
                    endingBalance: -1230,
                    remaining: -1230,
                    rollover: 0
                ),
                timeElapsedPercentage: 85,
                rolloverAmount: -350,
                previousBudgetMonth: "février"
            )
        }
        .padding()
    }
    .pulpeBackground()
    .environment(UserSettingsStore())
}
