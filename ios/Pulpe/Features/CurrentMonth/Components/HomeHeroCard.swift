import SwiftUI

/// Month-end estimate hero. Financial formulas stay in `BudgetFormulas`; this view only
/// translates their results into the signed, glanceable comparison shown on the dashboard.
/// The trajectory plot and its spoken description live in `HomeHeroCard+Chart.swift`.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    let plannedBalance: Decimal
    let trajectory: BudgetFormulas.BalanceTrajectory?
    let monthName: String
    let uncheckedCount: Int
    var onTapMetrics: () -> Void
    var onTapDetail: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var tapTrigger = false

    var currency: SupportedCurrency { userSettingsStore.currency }
    private var presentation: PresentationState {
        PresentationState(
            plannedBalance: plannedBalance,
            estimatedBalance: metrics.remaining,
            // Same signal the chart reads to draw "En attente d'un premier pointage", so the
            // sentence under it can never claim a verdict the plot says it is still waiting
            // for. No trajectory means no such claim on screen, so nothing to contradict.
            hasTrackedActivity: trajectory.map { !$0.hasNothingTracked } ?? true
        )
    }

    // MARK: - Semantic Styling

    private var accentColor: Color {
        switch presentation.tone {
        case .favorable: .financialSavings
        case .caution: .financialOverBudget
        case .deficit: .driftAccent
        }
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        presentation.accessibilityDescription(
            monthName: monthName,
            currency: currency,
            amountsHidden: amountsHidden,
            uncheckedCount: uncheckedCount
        )
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            metricsContent
            verdictSentence
        }
        // Drives the digit morph above: `contentTransition` is inert unless the value
        // change happens inside an animation, so the two ship together or neither works.
        .animation(DesignTokens.Animation.smoothEaseInOut, value: metrics)
    }

    // MARK: - Summary

    /// Same `VStack(spacing: .lg)` structure as before — only `summaryMetrics` sits behind
    /// the Button now. The amount and the chart never opened anything; wrapping all three
    /// made the 120pt chart tappable by accident and buried the one thing that does
    /// (the two metrics) inside a control with no chevron or ink to say so.
    private var metricsContent: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                heroAmount
                    .monospacedDigit()
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .foregroundStyle(Color.homeHeroInk)
                    // Every other hero amount in the app morphs its digits rather than
                    // swapping the figure whole; the split-typography rewrite dropped it
                    // here. Applied to the concatenated run, the currency suffix simply
                    // has no digits to animate.
                    .contentTransition(.numericText())
                    .sensitiveAmount()

                Text("estimé fin \(monthName)")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.homeHeroSupport)
            }

            Button {
                tapTrigger.toggle()
                onTapMetrics()
            } label: {
                summaryMetrics
            }
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvrir le suivi du réalisé")

            balanceChart
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Split Amount

    /// Dominant figure and its currency suffix on one baseline. Only a negative balance
    /// carries a sign — a `+` on money you still have reads as a variation, not a sum.
    private var heroAmount: Text {
        Text(presentation.estimatedBalance.asCompactAmount(for: currency))
            .font(PulpeTypography.dashboardHeroAmount)
            .tracking(DesignTokens.Tracking.hero)
            + Text(" \(currency.symbol)")
            .font(PulpeTypography.dashboardHeroCurrency)
    }

    // MARK: - Compact Summary

    @ViewBuilder
    private var summaryMetrics: some View {
        if dynamicTypeSize >= .xxLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: "à pointer", tint: Color.homeHeroInk)
                metric(value: varianceValue, label: "vs prévu", tint: accentColor, showsChevron: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: "à pointer", tint: Color.homeHeroInk)
                Spacer(minLength: DesignTokens.Spacing.sm)
                // Bookends of the hero: the right-hand pair hangs off the trailing margin
                // so both metrics share the hero's own edges.
                metric(
                    value: varianceValue,
                    label: "vs prévu",
                    tint: accentColor,
                    alignment: .trailing,
                    showsChevron: true
                )
            }
        }
    }

    private var uncheckedValue: String { "\(uncheckedCount)" }

    private var varianceValue: String { presentation.varianceText(for: currency) }

    /// Value over its own label, so neither depends on the copy around it to be read.
    private func metric(
        value: String,
        label: String,
        tint: Color,
        alignment: HorizontalAlignment = .leading,
        showsChevron: Bool = false
    ) -> some View {
        VStack(alignment: alignment, spacing: DesignTokens.Spacing.xxs) {
            Text(value)
                .font(PulpeTypography.amountCard)
                .foregroundStyle(tint)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .sensitiveAmount()

            Self.metricLabelText(label, showsChevron: showsChevron)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.homeHeroSupport)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    /// `Text(Image(...))` is a run inside one `Text`, not its own accessibility element —
    /// folds `verdictSentence`'s drill-in chevron into a metric's label line only, never
    /// the value's, so the mark never competes with the figure it points away from.
    private static func metricLabelText(_ label: String, showsChevron: Bool) -> Text {
        guard showsChevron else { return Text(label) }
        return Text("\(label) ") + Text(Image(systemName: "chevron.right")).font(PulpeTypography.metricLabel)
    }

    // MARK: - Verdict

    /// One sentence that ends in its own action — the row that used to carry `Voir le budget`
    /// is gone, so the creation action below is the strongest thing under the hero.
    /// The action reads as one by its ink and its chevron, the way the rest of the app
    /// marks a drill-in; an underline here would be a web idiom on an iOS surface.
    ///
    /// Standalone-row variant of the 44pt text link: this Button owns its row, so a frame
    /// can carry the tap target outright. `HomeSectionHeader` reaches the same 44pt through
    /// a padding sandwich instead, because there the link shares an HStack and a frame would
    /// grow the whole row — see `swiftui-hit-areas.md`. Two shapes, one rule, on purpose.
    private var verdictSentence: some View {
        Button(action: onTapDetail) {
            Text("\(presentation.verdictText) ")
                .foregroundStyle(accentColor)
                + Text("Voir le détail ")
                .foregroundStyle(Color.homeHeroInk)
                + Text(Image(systemName: "chevron.right"))
                .foregroundStyle(Color.homeHeroSupport)
                .font(PulpeTypography.metricLabel)
        }
        .font(PulpeTypography.labelLarge)
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .textLinkButtonStyle()
        // The verdict is already spoken by the metrics element above; repeating it here
        // would make VoiceOver say it twice in a row.
        .accessibilityLabel("Voir le détail du budget")
    }
}

// MARK: - Presentation State

extension HomeHeroCard {
    struct PresentationState: Equatable {
        enum Verdict: Equatable {
            case gain
            case overrun
            case onPlan
        }

        enum Tone: Equatable {
            case favorable
            case caution
            case deficit
        }

        let plannedBalance: Decimal
        let estimatedBalance: Decimal
        let variance: Decimal
        let verdict: Verdict
        let tone: Tone

        /// Whether the period has any pointed movement behind it. `verdict` compares two
        /// numbers and always has an answer; this says whether that answer means anything
        /// yet. Defaults to `true` so a caller that has no trajectory keeps the comparison.
        let hasTrackedActivity: Bool

        init(
            plannedBalance: Decimal,
            estimatedBalance: Decimal,
            hasTrackedActivity: Bool = true
        ) {
            self.plannedBalance = plannedBalance
            self.estimatedBalance = estimatedBalance
            self.hasTrackedActivity = hasTrackedActivity

            let difference = estimatedBalance - plannedBalance
            variance = difference
            verdict = difference > 0 ? .gain : difference < 0 ? .overrun : .onPlan
            tone = estimatedBalance < 0 ? .deficit : difference < 0 ? .caution : .favorable
        }

        /// Whether an envelope that ran past its plan was paid for elsewhere in the month.
        /// A month that lands exactly on plan absorbed it just as surely as one that landed
        /// above: only a month behind its own plan leaves the excess uncovered. Lives here
        /// rather than in the view so the card that says "compensé ailleurs" and the hero
        /// that says "conforme à ton budget" can never claim opposite things.
        var absorbsEnvelopeOverrun: Bool { verdict != .overrun }

        /// Qualitative half of the verdict. The number behind it lives in the `vs prévu`
        /// metric, so the sentence never repeats it. Until something is pointed the estimate
        /// equals the plan by construction, not by observation: "conforme à ton budget"
        /// would congratulate a brand-new account for a comparison nobody has made yet —
        /// under a chart that is still saying it waits for a first pointing.
        var verdictText: String {
            guard hasTrackedActivity else { return "Rien de pointé pour l'instant." }
            return switch verdict {
            case .gain: "Il te reste plus que prévu."
            case .overrun: "Il te reste moins que prévu."
            case .onPlan: "Tu es conforme à ton budget."
            }
        }

        /// Carries its unit even though the hero above already shows one: its neighbour in
        /// the pair is a count of operations, and two figures set in the same type on the
        /// same row have nothing else to say which of them is money.
        func varianceText(for currency: SupportedCurrency) -> String {
            variance.asArithmeticSignedCompactCurrency(currency)
        }

        func accessibilityDescription(
            monthName: String,
            currency: SupportedCurrency,
            amountsHidden: Bool,
            uncheckedCount: Int
        ) -> String {
            let month = monthName.capitalized
            let unchecked = switch uncheckedCount {
            case 0: "Aucune opération à pointer."
            case 1: "1 opération à pointer."
            default: "\(uncheckedCount) opérations à pointer."
            }
            guard !amountsHidden else {
                return """
                \(month). Solde estimé fin de mois, montant masqué. \
                Comparaison au budget masquée. \(unchecked)
                """
            }

            // Mirrors `verdictText`: VoiceOver and the sentence on screen say the same thing
            // about the same month, including the case where there is nothing to compare yet.
            let comparison = if !hasTrackedActivity {
                "Rien de pointé pour l'instant"
            } else {
                switch verdict {
                case .gain: "\(abs(variance).asCurrency(currency)) de mieux que prévu"
                case .overrun: "\(abs(variance).asCurrency(currency)) de moins que prévu"
                case .onPlan: "Conforme à ton budget"
                }
            }

            return """
            \(month). Solde estimé fin de mois \
            \(estimatedBalance.asArithmeticSignedCurrency(currency)). \(comparison). \(unchecked)
            """
        }
    }
}

#Preview("Estimated balance hero") {
    let gainTrajectory = BudgetFormulas.BalanceTrajectory(
        tracked: [
            .init(day: 0, balance: 8032),
            .init(day: 3, balance: 7580),
            .init(day: 8, balance: 6810),
            .init(day: 12, balance: 6430),
            .init(day: 17, balance: 5992),
        ],
        remainingPlan: [
            .init(day: 17, balance: 5992),
            .init(day: 31, balance: 1260),
        ],
        plannedBalance: 632,
        today: 17,
        totalDays: 31
    )
    ScrollView {
        HomeHeroCard(
            metrics: .init(
                totalIncome: 8032,
                totalExpenses: 6772,
                totalSavings: 0,
                available: 8032,
                endingBalance: 1260,
                remaining: 1260,
                rollover: 0
            ),
            plannedBalance: 632,
            trajectory: gainTrajectory,
            monthName: "juillet",
            uncheckedCount: 5,
            onTapMetrics: {},
            onTapDetail: {}
        )
        .padding(DesignTokens.Spacing.lg)
    }
    .background(Color.appBackground)
    .environment(UserSettingsStore())
}
