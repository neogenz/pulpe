import Charts
import Foundation
@testable import Pulpe
import Testing

/// What the home hero *says* about a month. The period arithmetic it says it about lives
/// in `BalanceTrajectoryTests`.
struct HomeHeroCardTests {
    @Test func estimateComparison_keepsSignedMeaning() {
        let state = HeroVerdictPresentation(
            plannedBalance: 450,
            estimatedBalance: 800
        )

        #expect(state.estimatedBalance == 800)
        #expect(state.variance == 350)
        #expect(state.verdict == .gain)
        #expect(state.tone == .favorable)

        let onPlan = HeroVerdictPresentation(
            plannedBalance: 450,
            estimatedBalance: 450
        )
        #expect(onPlan.variance == 0)
        #expect(onPlan.verdict == .onPlan)
    }

    @Test func estimateComparison_usesCentPrecision() {
        let dust = HeroVerdictPresentation(plannedBalance: 58.50, estimatedBalance: 58.504)
        #expect(dust.estimatedBalance == 58.50)
        #expect(dust.variance == 0)
        #expect(dust.verdict == .onPlan)

        let cent = HeroVerdictPresentation(plannedBalance: 58.50, estimatedBalance: 58.49)
        #expect(cent.variance == -0.01)
        #expect(cent.verdict == .overrun)
        #expect(cent.varianceText(for: .chf) == "-0.01 CHF")
    }

    @Test func envelopeOverrun_countsAsAbsorbedWhenTheMonthLandsExactlyOnPlan() {
        // A 200 overrun cancelled by 200 of free income lands the month exactly on plan.
        // `DriftCard` gates its "compensé ailleurs ce mois" clause on this: without the
        // on-plan case it says "200 CHF au-delà du plan" flat while the hero says
        // "Tu es pile sur ton plan" — two claims that contradict each other.
        let onPlan = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 450)
        #expect(onPlan.verdict == .onPlan)
        #expect(onPlan.absorbsEnvelopeOverrun)

        let gain = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 800)
        #expect(gain.absorbsEnvelopeOverrun)

        // The one month that genuinely leaves the excess uncovered.
        let overrun = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 300)
        #expect(!overrun.absorbsEnvelopeOverrun)
    }

    @Test func verdictSentence_datesTheDayTheMonthLeftItsPlan() throws {
        // The plot draws the gap and the metric beside it prints the figure. The one thing
        // neither can say is *when* it opened, so that is all the sentence is for.
        let below = HeroVerdictPresentation(
            plannedBalance: 2_500,
            estimatedBalance: 1_800,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        #expect(below.verdictText == "Tu dépenses plus que prévu depuis le 6 juillet.")

        let above = HeroVerdictPresentation(
            plannedBalance: 2_500,
            estimatedBalance: 2_900,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        #expect(above.verdictText == "Tu dépenses moins que prévu depuis le 6 juillet.")

        // "le 1 août" reads as a typo in a sentence; French declines this one day.
        let firstOfMonth = HeroVerdictPresentation(
            plannedBalance: 2_500,
            estimatedBalance: 1_800,
            driftDate: try date(year: 2026, month: 8, day: 1)
        )
        #expect(firstOfMonth.verdictText == "Tu dépenses plus que prévu depuis le 1er août.")

        // Where a new account lands right after onboarding: lines exist, nothing spent, so
        // the forecast still sits on the plan it opened on. That is a fact about the month,
        // not a compliment paid for a comparison nobody has made.
        let fresh = HeroVerdictPresentation(plannedBalance: 2_500, estimatedBalance: 2_500)
        #expect(fresh.verdict == .onPlan)
        #expect(fresh.verdictText == "Tu es pile sur ton plan.")

        // No plot to date the departure from: the sentence drops the clause, not the verdict.
        let undated = HeroVerdictPresentation(plannedBalance: 2_500, estimatedBalance: 1_800)
        #expect(undated.verdictText == "Il te reste moins que prévu.")
    }

    @Test func varianceMetric_carriesItsCurrencyBesideTheOperationCount() {
        // "Imprévus" shares its row with "à pointer", which is a count of operations. With
        // no unit the two are the same figure in the same type, and the money one is the
        // one that becomes unreadable.
        let onPlan = HeroVerdictPresentation(plannedBalance: 2_500, estimatedBalance: 2_500)
        #expect(onPlan.varianceText(for: .chf) == "0 CHF")

        let gain = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 800)
        #expect(gain.varianceText(for: .chf) == "+350 CHF")

        let overrun = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 300)
        #expect(overrun.varianceText(for: .eur) == "-150 €")
    }

    @Test func deficitAcrossZero_isOverrunAndDeficit() {
        let state = HeroVerdictPresentation(
            plannedBalance: 450,
            estimatedBalance: -3000
        )

        #expect(state.estimatedBalance == -3000)
        #expect(state.variance == -3450)
        #expect(state.verdict == .overrun)
        #expect(state.tone == .deficit)
    }

    @MainActor
    @Test func chartDomain_framesTheWholePlanSoDriftReadsAgainstTheMonth() {
        // A burn-down is read against what the month had: the frame holds the plan's
        // opening and its end, so 201 of drift on 9 000 planned is the near-flat line it is,
        // and 1 767 is a visible departure from the dashed plan without filling the frame.
        let quiet = trajectory(landing: [2_500, 2_400, 2_299], plannedOutflows: 9_000)
        let quietDomain = HomeHeroCard.chartYDomain(for: quiet)
        #expect(quietDomain.contains(11_500))
        #expect(quietDomain.contains(2_299))
        #expect(201.0 / (quietDomain.upperBound - quietDomain.lowerBound) < 0.05)

        let loud = trajectory(landing: [2_500, 1_500, 733], plannedOutflows: 9_000)
        let loudDomain = HomeHeroCard.chartYDomain(for: loud)
        let loudShare = 1_767.0 / (loudDomain.upperBound - loudDomain.lowerBound)
        #expect(loudShare > 0.1 && loudShare < 0.3)
    }

    @MainActor
    @Test func labels_sitUnderAFallingStrokeAndOverAClimbingOne() {
        // A label grows leftward from the stroke's end, where a falling line is higher:
        // it goes under. A plan with outflows always falls; the trend follows its slope.
        let spending = trajectory(landing: [2_500, 1_800], plannedOutflows: 9_000, totalDays: 31)
        #expect(HomeHeroCard.planLabelPosition(for: spending) == .bottom)
        #expect(HomeHeroCard.trendLabelPosition(for: spending) == .bottom)
        #expect(HomeHeroCard.todayLabelPosition(for: spending) == .top)
        // Even a month above its plan still has money to spend: the dashed stroke falls
        // from what is left today to what is left at the end, and its figure goes under.
        let recovering = trajectory(landing: [2_500, 2_900], plannedOutflows: 9_000, totalDays: 31)
        #expect(HomeHeroCard.trendLabelPosition(for: recovering) == .bottom)
        #expect(HomeHeroCard.planLabelPosition(for: trajectory(landing: [2_500, 2_500])) == .top)
        #expect(HomeHeroCard.trendLabelPosition(for: trajectory(landing: [2_500, 2_500])) == .top)
    }

    @MainActor
    @Test func plan_fallsFromTheOpeningAmountToWhatThePeriodKeeps() {
        let plan = HomeHeroCard.plan(for: trajectory(landing: [2_500, 1_800], plannedOutflows: 9_000, totalDays: 31))
        #expect(plan.map(\.day) == [0, 31])
        #expect(plan.map(\.balance) == [11_500, 2_500])
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
        let state = HeroVerdictPresentation(
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
        let gain = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 800)
        let overrun = HeroVerdictPresentation(
            plannedBalance: 450,
            estimatedBalance: 300,
            driftDate: try date(year: 2026, month: 7, day: 6)
        )
        let onPlan = HeroVerdictPresentation(plannedBalance: 450, estimatedBalance: 450)

        #expect(gain.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 2
        ).contains("350 CHF de mieux que prévu"))
        // Mirrors the sentence on screen, date included: the two must not describe the same
        // month differently depending on who is reading it.
        #expect(overrun.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 0
        ).contains("150 CHF de moins que prévu depuis le 6 juillet"))
        #expect(onPlan.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 1
        ).contains("Pile sur ton plan"))
    }

    @Test func loadedDashboardUsesOneFullScreenGradientBackground() throws {
        let iosRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let viewSource = try String(
            contentsOf: iosRoot.appending(path: "Pulpe/Features/CurrentMonth/CurrentMonthView.swift"),
            encoding: .utf8
        )
        let backgroundSource = try String(
            contentsOf: iosRoot.appending(
                path: "Pulpe/Shared/Components/HeroZone/HeroZoneSurface.swift"
            ),
            encoding: .utf8
        )

        #expect(viewSource.contains(".heroZone(parallax: true)"))
        #expect(viewSource.contains(".contentZone()"))
        #expect(!viewSource.contains(".background(Color.homeBackground)"))
        #expect(!viewSource.contains("HeroZoneTracker"))
        #expect(!viewSource.contains("LinearGradient("))
        #expect(backgroundSource.components(separatedBy: "LinearGradient(").count == 2)
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

        #expect(source.contains("Text(Self.subtitle(for: item))"))
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
    @Test func chartLabel_speaksTheThreeStrokesAndHidesAmountsOnDemand() throws {
        // 10 days in, 700 under plan, wide enough for the trend to get its figure.
        let drifted = trajectory(
            landing: Array(repeating: Decimal(2_500), count: 10) + [1_800],
            driftDate: try date(year: 2026, month: 7, day: 6),
            plannedOutflows: 9_000,
            totalDays: 31
        )

        // The strokes in the order they are drawn: opening, plan's end, real today, trend.
        let spoken = HomeHeroCard.chartAccessibilityLabel(
            for: drifted,
            currency: .chf,
            amountsHidden: false
        )
        #expect(spoken.hasPrefix(
            "Disponible prévu 11’500 CHF. Prévu fin de période 2’500 CHF. Réel aujourd’hui 10’800 CHF."
        ))
        #expect(spoken.contains("Si tu continues, "))

        // A month on its plan has no trend to speak of.
        let untouched = HomeHeroCard.chartAccessibilityLabel(
            for: trajectory(landing: [1_000, 1_000]),
            currency: .chf,
            amountsHidden: false
        )
        #expect(!untouched.contains("Si tu continues"))

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
        let points = landing.enumerated().map {
            BudgetFormulas.BalanceTrajectory.Point(day: $0.offset, balance: $0.element)
        }
        // The real stroke opens on what the period had and falls by the same drift, so a
        // fixture written in landing terms still draws a coherent burn-down.
        let opening = (landing.first ?? 0) + plannedOutflows
        return BudgetFormulas.BalanceTrajectory(
            landing: points,
            plannedAvailable: opening,
            real: points.map { .init(day: $0.day, balance: opening + $0.balance - (landing.first ?? 0)) },
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
