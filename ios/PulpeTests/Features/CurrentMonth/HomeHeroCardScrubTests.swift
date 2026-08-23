import Foundation
@testable import Pulpe
import Testing

/// The reading under the finger on the home burn-down. The gesture is plumbing; the
/// values it shows are what is asserted here.
struct HomeHeroCardScrubTests {
    // Day 10 of 31, opened on 11 500, plan lands on 2 500, real at 10 800, trend below.
    private let trajectory = BudgetFormulas.BalanceTrajectory(
        landing: (0 ... 10).map { .init(day: $0, balance: $0 < 10 ? 2_500 : 1_800) },
        plannedAvailable: 11_500,
        real: (0 ... 10).map { .init(day: $0, balance: $0 < 10 ? 11_500 : 10_800) },
        driftDate: nil,
        plannedOutflows: 9_000,
        today: 10,
        totalDays: 31,
        periodStart: Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 1))
    )

    @MainActor
    @Test func reading_beforeToday_hasTheRealAndThePlanButNoEstimate() {
        let reading = HomeHeroCard.scrubReading(at: 5, in: trajectory)
        #expect(reading.real == 11_500)
        #expect(reading.estimate == nil)
        // Plan: 11 500 → 2 500 over 31 days, 5/31 of the way down.
        #expect(reading.plan == (Decimal(11_500) - Decimal(9_000) * 5 / 31).rounded(2))
        #expect(reading.date == Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 5)))
    }

    @MainActor
    @Test func reading_today_hasTheRealAndNoEstimate() {
        let reading = HomeHeroCard.scrubReading(at: 10, in: trajectory)
        #expect(reading.real == 10_800)
        #expect(reading.estimate == nil)
    }

    @MainActor
    @Test func reading_afterToday_interpolatesTheEstimateAndHasNoReal() {
        let reading = HomeHeroCard.scrubReading(at: 31, in: trajectory)
        #expect(reading.real == nil)
        #expect(reading.estimate == HomeHeroCard.trend(for: trajectory))
        #expect(reading.plan == 2_500)
        let midway = HomeHeroCard.scrubReading(at: 20, in: trajectory)
        let end = HomeHeroCard.trend(for: trajectory)
        #expect(midway.estimate == (Decimal(10_800) + (end - 10_800) * 10 / 21).rounded(2))
    }

    @MainActor
    @Test func reading_clampsTheDayIntoThePeriod() {
        #expect(HomeHeroCard.scrubReading(at: -4, in: trajectory).day == 0)
        #expect(HomeHeroCard.scrubReading(at: 99, in: trajectory).day == 31)
    }

    @MainActor
    @Test func eyebrow_namesTheDayAndThePlan_andTheFigureIsTheReading() {
        let past = HomeHeroCard.scrubReading(at: 5, in: trajectory)
        #expect(HomeHeroCard.scrubEyebrow(past, currency: .chf).hasPrefix("Réel le 5 août · Prévu "))
        #expect(HomeHeroCard.scrubFigure(past) == 11_500)

        let future = HomeHeroCard.scrubReading(at: 20, in: trajectory)
        let eyebrow = HomeHeroCard.scrubEyebrow(future, currency: .chf)
        #expect(eyebrow.hasPrefix("Estimé le 20 août · Prévu "))
        #expect(eyebrow.hasSuffix("CHF"))
        #expect(HomeHeroCard.scrubFigure(future) == future.estimate)
    }
}
