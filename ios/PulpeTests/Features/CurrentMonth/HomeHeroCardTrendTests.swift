import Foundation
@testable import Pulpe
import Testing

/// The dashed stroke past today: the pace of the days lived, shrunk toward the plan by how
/// few they are, and named only once it is visibly apart from the estimate.
@Suite struct HomeHeroCardTrendTests {
    @MainActor
    @Test func trend_carriesTodaysPaceOverTheDaysLeft_shrunkByHowLittleIsKnown() {
        // Day 10 of 31, 700 under plan: 70/day, weighted 10/(10+7), over the 21 days left.
        let mid = trajectory(landing: Array(repeating: 2_500, count: 10) + [1_800], totalDays: 31)
        let expected = (Decimal(1_800) + Decimal(-70) * (Decimal(10) / Decimal(17)) * Decimal(21)).rounded(2)
        #expect(mid.trendBalance(priorDays: 7) == expected)
        #expect(HomeHeroCard.projection(for: mid).last?.balance == expected)

        // Day 1 with the same gap is mostly noise: the plan prior keeps it to 1/8 of the raw pace.
        let early = trajectory(landing: [2_500, 1_800], totalDays: 31)
        let raw = Decimal(1_800) - Decimal(700) * Decimal(30)
        #expect(early.trendBalance(priorDays: 7) == Decimal(1_800) - Decimal(700) / Decimal(8) * Decimal(30))
        #expect(early.trendBalance(priorDays: 7) > raw)
        #expect(early.trendBalance(priorDays: 0) == raw)

        // A held month lands on its estimate; so does the last day, whatever the drift.
        #expect(trajectory(landing: [2_500, 2_500], totalDays: 31).trendBalance(priorDays: 7) == 2_500)
        #expect(trajectory(landing: [2_500, 1_800], totalDays: 1).trendBalance(priorDays: 7) == 1_800)
    }

    @MainActor
    @Test func trendLabel_printsOnlyOnceTheTrendIsVisiblyApartFromTheEstimate() {
        let loud = trajectory(landing: [2_500, 1_800], plannedOutflows: 9_000, totalDays: 31)
        #expect(HomeHeroCard.showsTrendLabel(for: loud))
        #expect(HomeHeroCard.trendLabel(for: loud, currency: .chf).hasSuffix("CHF"))
        let quiet = trajectory(landing: [2_500, 2_495], plannedOutflows: 9_000, totalDays: 31)
        #expect(!HomeHeroCard.showsTrendLabel(for: quiet))
        #expect(!HomeHeroCard.showsTrendLabel(for: trajectory(landing: [2_500, 1_800], totalDays: 1)))
    }

    // MARK: - History prior

    /// Day 10 of 31, 700 under plan, planned outflows 9 000, usual drift −8 % over 6 months
    /// with K = 7: the pace term is the no-history trend, the prior adds
    /// 6/8 × −0.08 × 9 000 × 21/31 = −365.81, weighted 7/17.
    @MainActor
    @Test func trend_leansTowardTheUsualDrift_weightedByThePriorStrength() {
        let landing = Array(repeating: Decimal(2_500), count: 10) + [1_800]
        let plain = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31)
        let history = history(drift: -0.08, months: 6, strength: 7, mad: 10_000)
        let bent = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31, history: history)

        let weight = Decimal(10) / Decimal(17)
        let prior = Decimal(6) / Decimal(8) * Decimal(-0.08) * Decimal(9_000) * Decimal(21) / Decimal(31)
        let paceTerm = weight * Decimal(-70) * Decimal(21)
        let expected = (Decimal(1_800) + paceTerm + (1 - weight) * prior).rounded(2)
        #expect(bent.trendBalance(priorDays: 7) == expected)
        #expect(bent.trendBalance(priorDays: 7) < plain.trendBalance(priorDays: 7))
        #expect(HomeHeroCard.projection(for: bent).last?.balance == expected)

        // One closed month counts for a third of the prior, twelve for six sevenths.
        let one = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31,
                             history: self.history(drift: -0.08, months: 1, strength: 7, mad: 10_000))
        let twelve = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31,
                                history: self.history(drift: -0.08, months: 12, strength: 7, mad: 10_000))
        #expect(twelve.trendBalance(priorDays: 7) < one.trendBalance(priorDays: 7))
        #expect(one.trendBalance(priorDays: 7) < plain.trendBalance(priorDays: 7))

        // A stronger K leans further toward the history and less on this month's pace.
        let strong = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31,
                                history: self.history(drift: -0.08, months: 6, strength: 14, mad: 10_000))
        let strongPull = abs(strong.trendBalance(priorDays: 7) - Decimal(1_800))
        #expect(strongPull < abs(bent.trendBalance(priorDays: 7) - Decimal(1_800)))
    }

    @MainActor
    @Test func trend_withHistory_staysFlatBeforeDaySeven_andBendsFromIt() {
        let history = history(drift: -0.08, months: 6, strength: 7, mad: 10_000)
        let daySix = trajectory(
            landing: Array(repeating: Decimal(2_500), count: 6) + [1_800],
            plannedOutflows: 9_000, totalDays: 31, history: history
        )
        #expect(daySix.trendBalance(priorDays: 7) == 1_800)
        let daySeven = trajectory(
            landing: Array(repeating: Decimal(2_500), count: 7) + [1_800],
            plannedOutflows: 9_000, totalDays: 31, history: history
        )
        #expect(daySeven.trendBalance(priorDays: 7) < 1_800)
        // A held month with a history still leans: the prior is what the user usually does.
        let held = trajectory(
            landing: Array(repeating: Decimal(2_500), count: 11),
            plannedOutflows: 9_000, totalDays: 31, history: history
        )
        #expect(held.trendBalance(priorDays: 7) < 2_500)
    }

    @MainActor
    @Test func trend_priorNeverExceedsTheMad_andAZeroRateMatchesNoHistory() {
        let landing = Array(repeating: Decimal(2_500), count: 10) + [1_800]
        let huge = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31,
                              history: history(drift: -5, months: 12, strength: 7, mad: 50))
        let weight = Decimal(10) / Decimal(17)
        let capped = (Decimal(1_800) + weight * Decimal(-70) * Decimal(21) + (1 - weight) * Decimal(-50)).rounded(2)
        #expect(huge.trendBalance(priorDays: 7) == capped)

        // Alternating months zero the rate server-side; with the same K the line is today's.
        let zero = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31,
                              history: history(drift: 0, months: 4, strength: 7, mad: 400))
        let plain = trajectory(landing: landing, plannedOutflows: 9_000, totalDays: 31)
        #expect(zero.trendBalance(priorDays: 7) == plain.trendBalance(priorDays: 7))
    }

    private func history(drift: Decimal, months: Int, strength: Int, mad: Decimal) -> DriftHistory {
        DriftHistory(
            usualOutflowDrift: drift,
            closedMonths: months,
            priorStrength: strength,
            driftMad: mad,
            driftProfile: [0.25, 0.5, 0.75, 1]
        )
    }

    private func trajectory(
        landing: [Decimal],
        driftDate: Date? = nil,
        plannedOutflows: Decimal = 0,
        totalDays: Int? = nil,
        history: DriftHistory? = nil
    ) -> BudgetFormulas.BalanceTrajectory {
        let today = max(landing.count - 1, 1)
        return BudgetFormulas.BalanceTrajectory(
            landing: landing.enumerated().map { .init(day: $0.offset, balance: $0.element) },
            driftDate: driftDate,
            plannedOutflows: plannedOutflows,
            today: today,
            totalDays: totalDays ?? today + 1,
            history: history
        )
    }
}
