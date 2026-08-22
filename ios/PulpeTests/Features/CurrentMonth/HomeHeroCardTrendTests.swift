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
}
