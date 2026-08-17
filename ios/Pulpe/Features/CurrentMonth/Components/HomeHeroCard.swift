import SwiftUI

/// Month-end estimate hero. Financial formulas stay in `BudgetFormulas`; this view only
/// translates their results into the signed, glanceable comparison shown on the dashboard.
/// The trajectory plot and its spoken description live in `HomeHeroCard+Chart.swift`.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    /// Used only when there is no trajectory to read the plan's own origin from — a period
    /// the plot cannot draw because today falls outside it. Named for that precedence, so a
    /// caller can see at the call site that this value does not always reach the screen.
    let fallbackPlannedBalance: Decimal
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
            // The plot's own origin whenever there is a plot, so the rule under the hero and
            // the `vs prévu` beside it quote one number rather than two calculations of it.
            plannedBalance: trajectory?.plannedBalance ?? fallbackPlannedBalance,
            estimatedBalance: metrics.remaining,
            // The plot's own drift date, so the sentence dates the same departure the line
            // draws. No plot, no date — and the sentence drops to its undated form.
            driftDate: trajectory?.driftDate
        )
    }

    // MARK: - Semantic Styling

    /// One ink for the whole card — gap, sentence and plotted line. A month sitting exactly
    /// on its plan takes the neutral ink: green is how this card says "better than planned",
    /// so spending it on "as planned" would leave nothing to say the difference with.
    /// Read by `HomeHeroCard+Chart`.
    var accentColor: Color {
        guard presentation.verdict != .onPlan else { return Color.homeHeroInk }
        return switch presentation.tone {
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
                    .accessibilityIdentifier("homeProjectedBalanceAmount")

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
            .accessibilityIdentifier("homeHeroMetrics")

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
            + Text(verbatim: " \(currency.symbol)")
            .font(PulpeTypography.dashboardHeroCurrency)
    }

    // MARK: - Compact Summary

    @ViewBuilder
    private var summaryMetrics: some View {
        if dynamicTypeSize >= .xxLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: uncheckedLabel, tint: Color.homeHeroInk)
                metric(value: varianceValue, label: varianceLabel, tint: accentColor, showsChevron: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: uncheckedLabel, tint: Color.homeHeroInk)
                Spacer(minLength: DesignTokens.Spacing.sm)
                // Bookends of the hero: the right-hand pair hangs off the trailing margin
                // so both metrics share the hero's own edges.
                metric(
                    value: varianceValue,
                    label: varianceLabel,
                    tint: accentColor,
                    alignment: .trailing,
                    showsChevron: true
                )
            }
        }
    }

    private var uncheckedValue: String { "\(uncheckedCount)" }

    private var uncheckedLabel: String { AppLocale.string("à pointer") }

    private var varianceValue: String { presentation.varianceText(for: currency) }

    private var varianceLabel: String { AppLocale.string("vs prévu") }

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
        return Text(verbatim: "\(label) ")
            + Text(Image(systemName: "chevron.right")).font(PulpeTypography.metricLabel)
    }

    // MARK: - Verdict

    /// One sentence that ends in its own action — the row that used to carry `Voir le budget`
    /// is gone, so the creation action below is the strongest thing under the hero.
    /// The action reads as one by its ink and its chevron, the way the rest of the app
    /// marks a drill-in; an underline here would be a web idiom on an iOS surface.
    ///
    /// Standalone-row variant of the 44pt text link: this Button owns its row, so a frame
    /// can carry the tap target outright. `SectionHeader` reaches the same 44pt through
    /// a padding sandwich instead, because there the link shares an HStack and a frame would
    /// grow the whole row — see `swiftui-hit-areas.md`. Two shapes, one rule, on purpose.
    private var verdictSentence: some View {
        Button(action: onTapDetail) {
            Text(verbatim: "\(presentation.verdictText) ")
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
        .accessibilityIdentifier("homeBudgetDetailLink")
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

        /// The day the month left its plan, straight from the plot below. `nil` when it never
        /// did — and also when there is no plot to date it from, where the sentence simply
        /// drops the date rather than inventing one.
        let driftDate: Date?

        init(
            plannedBalance: Decimal,
            estimatedBalance: Decimal,
            driftDate: Date? = nil
        ) {
            self.plannedBalance = plannedBalance
            self.estimatedBalance = estimatedBalance
            self.driftDate = driftDate

            let difference = estimatedBalance - plannedBalance
            variance = difference
            verdict = difference > 0 ? .gain : difference < 0 ? .overrun : .onPlan
            tone = estimatedBalance < 0 ? .deficit : difference < 0 ? .caution : .favorable
        }

        /// Whether an envelope that ran past its plan was paid for elsewhere in the month.
        /// A month that lands exactly on plan absorbed it just as surely as one that landed
        /// above: only a month behind its own plan leaves the excess uncovered. Lives here
        /// rather than in the view so the card that says "compensé ailleurs" and the hero
        /// that says "pile sur ton plan" can never claim opposite things.
        var absorbsEnvelopeOverrun: Bool { verdict != .overrun }

        /// The one thing on the card the plot cannot draw and the metrics cannot show: *when*
        /// the month left its plan. The size of the gap is in `vs prévu`, its shape is in the
        /// line, so repeating either here would spend the sentence on something already said.
        var verdictText: String {
            switch verdict {
            case .onPlan:
                AppLocale.string("Tu es pile sur ton plan.")
            case .overrun:
                if let day = driftDay {
                    AppLocale.string("Sous ton plan depuis le \(day).")
                } else {
                    AppLocale.string("Il te reste moins que prévu.")
                }
            case .gain:
                if let day = driftDay {
                    AppLocale.string("Au-dessus de ton plan depuis le \(day).")
                } else {
                    AppLocale.string("Il te reste plus que prévu.")
                }
            }
        }

        /// The drift day, already formatted. Whole sentences carry it rather than a
        /// "\(lead) depuis le …" template: only French puts the clause in that order.
        private var driftDay: String? {
            driftDate.map { Formatters.dayMonthLabel(for: $0) }
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
            // One key for every non-zero count: the singular is a plural variant of it in
            // the catalog, not a second sentence assembled here.
            let unchecked = uncheckedCount == 0
                ? AppLocale.string("Aucune opération à pointer.")
                : AppLocale.string("\(uncheckedCount) opérations à pointer.")
            guard !amountsHidden else {
                return AppLocale.string("""
                    \(month). Solde estimé fin de mois, montant masqué. \
                    Comparaison au budget masquée. \(unchecked)
                    """)
            }

            // Mirrors `verdictText`: VoiceOver and the sentence on screen say the same thing
            // about the same month, down to the day it left its plan.
            let gap = abs(variance).asCurrency(currency)
            let comparison = switch (verdict, driftDay) {
            case (.gain, let day?): AppLocale.string("\(gap) de mieux que prévu depuis le \(day)")
            case (.gain, nil): AppLocale.string("\(gap) de mieux que prévu")
            case (.overrun, let day?): AppLocale.string("\(gap) de moins que prévu depuis le \(day)")
            case (.overrun, nil): AppLocale.string("\(gap) de moins que prévu")
            case (.onPlan, _): AppLocale.string("Pile sur ton plan")
            }

            return AppLocale.string("""
                \(month). Solde estimé fin de mois \
                \(estimatedBalance.asArithmeticSignedCurrency(currency)). \(comparison). \(unchecked)
                """)
        }
    }
}

#Preview("Estimated balance hero") {
    let gainTrajectory = BudgetFormulas.BalanceTrajectory(
        landing: [
            .init(day: 0, balance: 632),
            .init(day: 3, balance: 632),
            .init(day: 8, balance: 1_020),
            .init(day: 12, balance: 1_020),
            .init(day: 17, balance: 1_260),
        ],
        driftDate: Calendar.current.date(from: DateComponents(year: 2026, month: 7, day: 8)),
        plannedOutflows: 6_772,
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
            fallbackPlannedBalance: 632,
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
