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
    /// A home entry is still on its way to the server: the projection is drawn from an
    /// optimistic store and says so by shimmering until the response lands.
    var isSettling = false
    /// Each tile opens its own thing: the count goes to the deck of operations to point,
    /// the variance to the realized sheet. One button for both was one tap with two
    /// chevrons and one surprise.
    var onTapUnchecked: () -> Void
    var onTapVariance: () -> Void
    var onTapDetail: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(\.scenePhase) var scenePhase
    @State private var tapTrigger = false
    @State var settlePulse = false
    /// The day under the finger while the plot is being scrubbed, `nil` at rest.
    @State var scrubDay: Int?

    var currency: SupportedCurrency { userSettingsStore.currency }
    private var presentation: HeroVerdictPresentation {
        HeroVerdictPresentation(
            // The plot's own origin whenever there is a plot, so the rule under the hero and
            // the `Imprévus` beside it quote one number rather than two calculations of it.
            plannedBalance: trajectory?.plannedBalance ?? fallbackPlannedBalance,
            estimatedBalance: metrics.remaining,
            // The plot's own drift date, so the sentence dates the same departure the line
            // draws. No plot, no date — and the sentence drops to its undated form.
            driftDate: trajectory?.driftDate
        )
    }

    // MARK: - Semantic Styling

    /// One accent for the whole card, spent on the variance tile alone. The surface never
    /// takes it (The Two-Zone Rule).
    private var accentColor: Color { presentation.accent }

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

    /// One read order, top to bottom: the figure, the line that explains it, the two
    /// numbers that qualify it, the sentence that concludes. The chart runs edge to edge
    /// because it is the picture of the month, not a widget inside it.
    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            HeroFigure(
                eyebrow: AppLocale.string("Estimé fin \(monthName)"),
                amount: presentation.estimatedBalance,
                currency: currency,
                alignment: .leading,
                accessibilityIdentifier: "homeProjectedBalanceAmount"
            )

            VStack(spacing: DesignTokens.Spacing.xs) {
                balanceChart
                chartTimeAxis
            }

            summaryMetrics

            verdictSentence
        }
        // Drives the digit morph above: `contentTransition` is inert unless the value
        // change happens inside an animation, so the two ship together or neither works.
        .animation(DesignTokens.Animation.smoothEaseInOut, value: metrics)
    }

    // MARK: - Summary

    /// Only the two tiles open anything. The amount and the chart stay outside any
    /// control: wrapping them made the chart tappable by accident.
    private var summaryMetrics: some View {
        HeroMetricTileRow {
            Button {
                tapTrigger.toggle()
                onTapUnchecked()
            } label: {
                HeroMetricTile(label: uncheckedLabel, value: uncheckedValue, showsChevron: uncheckedCount > 0)
            }
            .disabled(uncheckedCount == 0)
            .accessibilityLabel(presentation.uncheckedAccessibilityText(count: uncheckedCount))
            .accessibilityHint(AppLocale.string("Aller aux opérations à pointer"))
            .accessibilityIdentifier("homeHeroUnchecked")

            Button {
                tapTrigger.toggle()
                onTapVariance()
            } label: {
                HeroMetricTile(label: varianceLabel, value: varianceValue, tint: accentColor, showsChevron: true)
            }
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvrir le suivi du réalisé")
            .accessibilityIdentifier("homeHeroMetrics")
        }
        .plainPressedButtonStyle()
        .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
    }

    private var uncheckedValue: String { "\(uncheckedCount)" }

    private var uncheckedLabel: String { AppLocale.string("À pointer") }

    private var varianceValue: String { presentation.varianceText(for: currency) }

    private var varianceLabel: String { AppLocale.string("Imprévus") }

    // MARK: - Verdict

    /// One sentence that ends in its own action. The verdict is already spoken by the
    /// metrics element above; repeating it here would make VoiceOver say it twice in a row.
    /// The link takes the hero's ink: the accent is spent on the `Imprévus` amount alone,
    /// so orange means "the month's gap", never "tap here".
    private var verdictSentence: some View {
        HeroVerdictRow(
            sentence: presentation.verdictText,
            linkTitle: AppLocale.string("Voir le budget"),
            accent: .heroInk,
            action: onTapDetail,
            accessibilityLabel: AppLocale.string("Voir le détail du budget"),
            accessibilityIdentifier: "homeBudgetDetailLink"
        )
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
        plannedAvailable: 8_032,
        real: [
            .init(day: 0, balance: 8_032),
            .init(day: 3, balance: 6_900),
            .init(day: 8, balance: 6_100),
            .init(day: 12, balance: 5_400),
            .init(day: 17, balance: 4_800),
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
            onTapUnchecked: {},
            onTapVariance: {},
            onTapDetail: {}
        )
        .padding(DesignTokens.Spacing.lg)
    }
    .background(Color.heroSurface)
    .environment(UserSettingsStore())
}
