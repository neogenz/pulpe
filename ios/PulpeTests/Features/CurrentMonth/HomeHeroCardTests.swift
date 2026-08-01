import Charts
import Foundation
@testable import Pulpe
import Testing

/// What the home hero *says* about a month. The period arithmetic it says it about lives
/// in `BalanceTrajectoryTests`.
struct HomeHeroCardTests {
    @Test func estimateComparison_keepsSignedMeaning() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: 800
        )

        #expect(state.estimatedBalance == 800)
        #expect(state.variance == 350)
        #expect(state.verdict == .gain)
        #expect(state.tone == .favorable)

        let onPlan = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: 450
        )
        #expect(onPlan.variance == 0)
        #expect(onPlan.verdict == .onPlan)
    }

    @Test func envelopeOverrun_countsAsAbsorbedWhenTheMonthLandsExactlyOnPlan() {
        // A 200 overrun cancelled by 200 of free income lands the month exactly on plan.
        // `DriftCard` gates its "compensé ailleurs ce mois" clause on this: without the
        // on-plan case it says "200 CHF au-delà du plan" flat while the hero says
        // "Tu es pile sur ton plan" — two claims that contradict each other.
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 450)
        #expect(onPlan.verdict == .onPlan)
        #expect(onPlan.absorbsEnvelopeOverrun)

        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        #expect(gain.absorbsEnvelopeOverrun)

        // The one month that genuinely leaves the excess uncovered.
        let overrun = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 300)
        #expect(!overrun.absorbsEnvelopeOverrun)
    }

    @Test func verdictSentence_datesTheDayTheMonthLeftItsPlan() throws {
        // The plot draws the gap and the metric beside it prints the figure. The one thing
        // neither can say is *when* it opened, so that is all the sentence is for.
        let below = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 1_800,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        #expect(below.verdictText == "Sous ton plan depuis le 6 juillet.")

        let above = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 2_900,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        #expect(above.verdictText == "Au-dessus de ton plan depuis le 6 juillet.")

        // "le 1 août" reads as a typo in a sentence; French declines this one day.
        let firstOfMonth = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 1_800,
            driftDate: try date(year: 2026, month: 8, day: 1)
        )
        #expect(firstOfMonth.verdictText == "Sous ton plan depuis le 1er août.")

        // Where a new account lands right after onboarding: lines exist, nothing spent, so
        // the forecast still sits on the plan it opened on. That is a fact about the month,
        // not a compliment paid for a comparison nobody has made.
        let fresh = HomeHeroCard.PresentationState(plannedBalance: 2_500, estimatedBalance: 2_500)
        #expect(fresh.verdict == .onPlan)
        #expect(fresh.verdictText == "Tu es pile sur ton plan.")

        // No plot to date the departure from: the sentence drops the clause, not the verdict.
        let undated = HomeHeroCard.PresentationState(plannedBalance: 2_500, estimatedBalance: 1_800)
        #expect(undated.verdictText == "Il te reste moins que prévu.")
    }

    @Test func varianceMetric_carriesItsCurrencyBesideTheOperationCount() {
        // "vs prévu" shares its row with "à pointer", which is a count of operations. With
        // no unit the two are the same figure in the same type, and the money one is the
        // one that becomes unreadable.
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 2_500, estimatedBalance: 2_500)
        #expect(onPlan.varianceText(for: .chf) == "0 CHF")

        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        #expect(gain.varianceText(for: .chf) == "+350 CHF")

        let overrun = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 300)
        #expect(overrun.varianceText(for: .eur) == "-150 €")
    }

    @Test func deficitAcrossZero_isOverrunAndDeficit() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: -3000
        )

        #expect(state.estimatedBalance == -3000)
        #expect(state.variance == -3450)
        #expect(state.verdict == .overrun)
        #expect(state.tone == .deficit)
    }

    @MainActor
    @Test func chartDomain_floorsAQuietMonthOnWhatThePeriodPlannedToSpend() {
        // Two real months of the production export, both on ~9 000 of planned outflows.
        // Scaled to itself, May's 201 of drift plunges from one edge of the frame to the
        // other and reads as an accident; floored on the plan it is the near-flat line it is.
        let quiet = trajectory(landing: [2_500, 2_400, 2_299], plannedOutflows: 9_000)
        let quietDomain = HomeHeroCard.chartYDomain(for: quiet)
        let quietShare = 201.0 / (quietDomain.upperBound - quietDomain.lowerBound)
        #expect(quietShare < 0.35)

        // April's 1 767 still fills its frame: the floor must not flatten everything.
        let loud = trajectory(landing: [2_500, 1_500, 733], plannedOutflows: 9_000)
        let loudDomain = HomeHeroCard.chartYDomain(for: loud)
        let loudShare = 1_767.0 / (loudDomain.upperBound - loudDomain.lowerBound)
        #expect(loudShare > 0.5)
    }

    @MainActor
    @Test func chartLabels_sitOnOppositeSidesOfThePlanRule() {
        // The mockups overlapped on an early day, with both labels in the same band. Placing
        // them across the rule makes that arrangement unreachable rather than unlikely.
        let below = trajectory(landing: [2_500, 1_800])
        #expect(HomeHeroCard.ruleLabelPosition(for: below) == .top)
        #expect(HomeHeroCard.gapLabelPosition(for: below) == .bottom)

        let above = trajectory(landing: [2_500, 2_900])
        #expect(HomeHeroCard.ruleLabelPosition(for: above) == .bottom)
        #expect(HomeHeroCard.gapLabelPosition(for: above) == .top)

        let held = trajectory(landing: [2_500, 2_500])
        #expect(HomeHeroCard.ruleLabelPosition(for: held) == .top)
        #expect(HomeHeroCard.gapLabelPosition(for: held) == .bottom)
    }

    @MainActor
    @Test func anchorLabel_namesTheGapOnlyWhenThePlotHasRoomForIt() {
        let wide = trajectory(landing: [2_500, 1_800], plannedOutflows: 9_000)
        #expect(HomeHeroCard.anchorLabel(for: wide, currency: .chf) == "-700 CHF")

        // 30 CHF on a plot floored at 450: closer to the plan's own label than a line height.
        // The `vs prévu` metric above still prints it, so nothing is hidden by staying quiet.
        let narrow = trajectory(landing: [2_500, 2_470], plannedOutflows: 9_000)
        #expect(HomeHeroCard.anchorLabel(for: narrow, currency: .chf) == "Aujourd’hui")

        let held = trajectory(landing: [2_500, 2_500], plannedOutflows: 9_000)
        #expect(HomeHeroCard.anchorLabel(for: held, currency: .chf) == "Aujourd’hui")
    }

    @MainActor
    @Test func chartDomain_holdsEveryReadingIncludingAMonthThatNeverMoved() {
        let drifted = trajectory(landing: [100, 80, -40])
        let driftedDomain = HomeHeroCard.chartYDomain(for: drifted)
        #expect(driftedDomain.contains(100))
        #expect(driftedDomain.contains(-40))

        // A month held exactly on plan is a single value, and still needs a frame to sit in.
        let flat = trajectory(landing: [50, 50, 50])
        let flatDomain = HomeHeroCard.chartYDomain(for: flat)
        #expect(flatDomain.lowerBound < 50)
        #expect(flatDomain.upperBound > 50)
    }

    @Test func hiddenAmounts_accessibilityDescriptionContainsNoFinancialValue() {
        let state = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: -3000
        )

        let description = state.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: true,
            uncheckedCount: 1
        )

        #expect(
            description
                == """
                Juillet. Solde estimé fin de mois, montant masqué. \
                Comparaison au budget masquée. 1 opération à pointer.
                """
        )
        #expect(!description.contains("CHF"))
        #expect(!description.contains("450"))
        #expect(!description.contains("3000"))
    }

    @Test func accessibilityDescription_explainsComparisonInEverydayFrench() throws {
        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        let overrun = HomeHeroCard.PresentationState(
            plannedBalance: 450,
            estimatedBalance: 300,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 450)

        #expect(gain.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 2
        ).contains("350.00 CHF de mieux que prévu"))
        // Mirrors the sentence on screen, date included: the two must not describe the same
        // month differently depending on who is reading it.
        #expect(overrun.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 0
        ).contains("150.00 CHF de moins que prévu depuis le 6 juillet"))
        #expect(onPlan.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 1
        ).contains("Pile sur ton plan"))
    }

    @Test func loadedDashboardUsesOneFullScreenGradientBackground() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/CurrentMonthView.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(source.contains(".background { dashboardBackground.ignoresSafeArea() }"))
        #expect(!source.contains(".background(Color.homeBackground)"))
        #expect(source.components(separatedBy: "LinearGradient(").count == 2)
    }

    /// The row used to state the tag count twice, in the same ink and the same size: once
    /// spelled out in the subtitle ("récurrent · 2 tags") and once by the component beside
    /// it ("· 🏷 2"). `TagChips` owns the icon, the separator and the ink, so it is the one
    /// that speaks — and the subtitle went back to being a subtitle.
    @Test func uncheckedOperationStatesItsTagCountOnce() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/Components/UncheckedOperationsCard.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(source.contains("Text(subtitle(for: item))"))
        #expect(!source.contains("tag\\("))
        #expect(source.components(separatedBy: "presentation: .count").count == 2)
    }

    @Test func loadingDashboardSkeletonMirrorsTheChartHero() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/Components/CurrentMonthSkeletonView.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(source.contains("CurrentMonthHeroSkeleton()"))
        #expect(source.contains("private var chartSkeleton: some View"))
        #expect(source.contains("contentActionSkeleton"))
        #expect(source.contains("uncheckedCardSkeleton"))
        #expect(source.contains("activityCardSkeleton"))
        #expect(!source.contains("height: DesignTokens.Skeleton.heroHeight"))
    }

    @Test func drift_isTheDistanceFromThePlanTheLineOpenedOn() {
        let held = trajectory(landing: [1_000, 1_000, 1_000])
        #expect(held.plannedBalance == 1_000)
        #expect(held.estimatedBalance == 1_000)
        #expect(held.drift == 0)

        let slipped = trajectory(landing: [1_000, 1_000, 900])
        #expect(slipped.drift == -100)
    }

    @MainActor
    @Test func chartLabel_speaksTheSubtractionAndHidesAmountsOnDemand() throws {
        let drifted = trajectory(
            landing: [1_000, 900],
            driftDate: try date(year: 2026, month: 7, day: 6)
        )

        // The three things the drawing shows, in the order it shows them. Not a reading of
        // every point: VoiceOver would get a list where the plot gives one subtraction.
        let spoken = HomeHeroCard.chartAccessibilityLabel(
            for: drifted,
            currency: .chf,
            amountsHidden: false
        )
        #expect(spoken.hasPrefix("Prévu "))
        #expect(spoken.contains("Atterrissage estimé"))
        #expect(spoken.contains("Écart -100 CHF depuis le 6 juillet."))

        // A month still on its plan has no gap to speak of, and says so rather than
        // reciting a zero — the plot draws nothing there either.
        let untouched = HomeHeroCard.chartAccessibilityLabel(
            for: trajectory(landing: [1_000, 1_000]),
            currency: .chf,
            amountsHidden: false
        )
        #expect(untouched.contains("Aucun écart au plan."))

        let masked = HomeHeroCard.chartAccessibilityLabel(
            for: drifted,
            currency: .chf,
            amountsHidden: true
        )
        let leaksADigit = masked.contains(where: \.isNumber)
        #expect(!leaksADigit)
    }

    @Test func heroCopyDropsPlanVarianceAndDailyRateKpis() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        #expect(!source.contains("\"Écart estimé\""))
        #expect(!source.contains("\"Plan\""))
        #expect(!source.contains("/jour"))
    }

    /// One reading per day, so the origin is the plan and the last point is the estimate —
    /// the shape `calculateBalanceTrajectory` always returns. `totalDays` defaults to one
    /// day past today; pass `today + 1`'s value to sit on the last day of the period.
    private func trajectory(
        landing: [Decimal],
        driftDate: Date? = nil,
        plannedOutflows: Decimal = 0,
        totalDays: Int? = nil
    ) -> BudgetFormulas.BalanceTrajectory {
        let today = max(landing.count - 1, 1)
        return BudgetFormulas.BalanceTrajectory(
            landing: landing.enumerated().map { .init(day: $0.offset, balance: $0.element) },
            driftDate: driftDate,
            plannedOutflows: plannedOutflows,
            today: today,
            totalDays: totalDays ?? today + 1
        )
    }

    private func date(year: Int, month: Int, day: Int) throws -> Date {
        try #require(Calendar.current.date(
            from: DateComponents(year: year, month: month, day: day)
        ))
    }
}
