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
        // "Tu es conforme à ton budget" — two claims that contradict each other.
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 450)
        #expect(onPlan.verdict == .onPlan)
        #expect(onPlan.absorbsEnvelopeOverrun)

        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        #expect(gain.absorbsEnvelopeOverrun)

        // The one month that genuinely leaves the excess uncovered.
        let overrun = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 300)
        #expect(!overrun.absorbsEnvelopeOverrun)
    }

    @Test func freshBudget_doesNotClaimComplianceBeforeTheBalanceMoves() {
        // Where a new account lands right after onboarding: lines exist, nothing pointed,
        // so the estimate equals the plan by construction. "Tu es conforme à ton budget"
        // congratulates the user for a comparison nobody has made. The replacement says why
        // there is no verdict rather than what the user has failed to do — someone who just
        // pointed their salary is in this state too, and has done nothing wrong.
        let fresh = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 2_500,
            hasBalanceMoved: false
        )
        #expect(fresh.verdict == .onPlan)
        #expect(fresh.verdictText == "Trop tôt pour comparer.")

        let started = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 2_500,
            hasBalanceMoved: true
        )
        #expect(started.verdictText == "Tu es conforme à ton budget.")

        // VoiceOver reads its own sentence — it has to reach the same conclusion.
        #expect(fresh.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 1
        ).contains("Trop tôt pour comparer"))
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

        // Same card, four lines apart: a hard `0 CHF` under a sentence saying the
        // comparison cannot be made yet was the card contradicting itself.
        let untouched = HomeHeroCard.PresentationState(
            plannedBalance: 2_500,
            estimatedBalance: 2_500,
            hasBalanceMoved: false
        )
        #expect(untouched.varianceText(for: .chf) == "—")
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
    @Test func chartDomain_containsPlanAboveBelowAndEqualToTrajectory() {
        let above = trajectory(tracked: [100, 80], remainingPlan: [80, 60], plan: 200)
        let aboveDomain = HomeHeroCard.chartYDomain(for: above)
        #expect(aboveDomain.contains(60))
        #expect(aboveDomain.contains(200))

        let below = trajectory(tracked: [100, 80], remainingPlan: [80, 60], plan: -100)
        let belowDomain = HomeHeroCard.chartYDomain(for: below)
        #expect(belowDomain.contains(-100))
        #expect(belowDomain.contains(100))

        let flat = trajectory(tracked: [50, 50], remainingPlan: [50, 50], plan: 50)
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

    @Test func accessibilityDescription_explainsComparisonInEverydayFrench() {
        let gain = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 800)
        let overrun = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 300)
        let onPlan = HomeHeroCard.PresentationState(plannedBalance: 450, estimatedBalance: 450)

        #expect(gain.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 2
        ).contains("350.00 CHF de mieux que prévu"))
        #expect(overrun.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 0
        ).contains("150.00 CHF de moins que prévu"))
        #expect(onPlan.accessibilityDescription(
            monthName: "juillet",
            currency: .chf,
            amountsHidden: false,
            uncheckedCount: 1
        ).contains("Conforme à ton budget"))
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

    @Test func nothingTracked_isFlagOnlyWhileEveryTrackedDayHoldsTheOpeningBalance() {
        let untouched = trajectory(tracked: [1_000, 1_000, 1_000], remainingPlan: [1_000, 300], plan: 250)
        #expect(untouched.hasNothingTracked)

        let started = trajectory(tracked: [1_000, 1_000, 900], remainingPlan: [900, 300], plan: 250)
        #expect(!started.hasNothingTracked)
    }

    @MainActor
    @Test func chartLabel_speaksTheTrajectoryAndHidesAmountsOnDemand() {
        let tracked = trajectory(tracked: [1_000, 900], remainingPlan: [900, 300], plan: 250)

        let spoken = HomeHeroCard.chartAccessibilityLabel(
            for: tracked,
            currency: .chf,
            amountsHidden: false
        )
        #expect(spoken.contains("Début de période"))
        #expect(spoken.contains("Aujourd’hui"))
        #expect(spoken.contains("Fin de période estimée"))
        #expect(spoken.contains("Prévu"))

        // The plot draws its projection before anything is pointed, so the label owes the
        // same account of it — a new account gets told where the month is heading.
        let untouched = HomeHeroCard.chartAccessibilityLabel(
            for: trajectory(tracked: [1_000, 1_000], remainingPlan: [1_000, 300], plan: 250),
            currency: .chf,
            amountsHidden: false
        )
        #expect(untouched.contains("Fin de période estimée"))
        #expect(untouched.contains("Prévu"))

        let masked = HomeHeroCard.chartAccessibilityLabel(
            for: tracked,
            currency: .chf,
            amountsHidden: true
        )
        let leaksADigit = masked.contains(where: \.isNumber)
        #expect(!leaksADigit)
    }

    @MainActor
    @Test func chartLabel_onTheLastDay_saysWhyThereIsNoProjectionLeft() {
        // The only day with no `remainingPlan` to speak. Every other label ends on where
        // the month is heading, so this one has to say why it cannot.
        let lastDay = trajectory(tracked: [1_000, 900], remainingPlan: [], plan: 250)

        let spoken = HomeHeroCard.chartAccessibilityLabel(
            for: lastDay,
            currency: .chf,
            amountsHidden: false
        )

        #expect(spoken.contains("Dernier jour de la période"))
        #expect(!spoken.contains("Fin de période estimée"))
        #expect(spoken.contains("Aujourd’hui"))
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

    private func trajectory(
        tracked: [Decimal],
        remainingPlan: [Decimal],
        plan: Decimal
    ) -> BudgetFormulas.BalanceTrajectory {
        BudgetFormulas.BalanceTrajectory(
            tracked: tracked.enumerated().map { .init(day: $0.offset, balance: $0.element) },
            remainingPlan: remainingPlan.enumerated().map {
                .init(day: $0.offset + 1, balance: $0.element)
            },
            plannedBalance: plan,
            today: 1,
            totalDays: 2
        )
    }
}
