import Foundation
@testable import Pulpe
import Testing

/// `suggestedMonthlyContribution` (PUL-285 CA1/CA6 — mirror of shared spec).
/// Split from `SavingsPlanCalculatorTests` (own fixtures, no shared timeline)
/// to keep both suites under the `type_body_length` ceiling.
@Suite("SavingsPlanCalculator.suggestedMonthlyContribution")
struct SavingsPlanSuggestedContributionTests {
    private static func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = 12
        return Calendar.current.date(from: components) ?? Date(timeIntervalSince1970: 0)
    }

    @Test("divides the target across remaining months, current and deadline inclusive")
    func suggestion_dividesAcrossRemainingMonths() {
        let suggestion = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100_000,
            targetDate: Self.date(2030, 5, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        )

        #expect(suggestion == Decimal(string: "2083.34"))
    }

    @Test("rounds UP to the cent so suggestion × months covers the target")
    func suggestion_roundsUpToTheCent() throws {
        let suggestion = try #require(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100_000,
            targetDate: Self.date(2030, 5, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ))

        #expect(suggestion * 48 >= 100_000)
    }

    @Test("is payDay-aware — a payDay before today shifts the current period")
    func suggestion_isPayDayAware() {
        let withoutPayDay = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 1200,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 28)
        )
        let withPayDay = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 1200,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: 25,
            now: Self.date(2026, 6, 28)
        )

        #expect(withoutPayDay != withPayDay)
    }

    @Test("returns nil when the deadline is past or the target non-positive")
    func suggestion_nilOnDegenerateInputs() {
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 5000,
            targetDate: Self.date(2026, 1, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ) == nil)
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 0,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        ) == nil)
    }

    // MARK: - Initial amount (PUL-293) — same cases as the shared spec

    @Test("only decomposes what is left to save once an initial amount covers part of the target")
    func suggestion_deductsInitialAmount() {
        let suggestion = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 10_000,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            initialAmount: 5000,
            now: Self.date(2026, 6, 15)
        )

        // 5 000 restants ÷ 7 mois, pas 10 000 ÷ 7.
        #expect(suggestion == Decimal(string: "714.29"))
    }

    @Test("stays identical when the initial amount is absent or zero")
    func suggestion_zeroInitialAmountIsNoOp() {
        let absent = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 10_000,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            now: Self.date(2026, 6, 15)
        )
        let zero = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 10_000,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            initialAmount: 0,
            now: Self.date(2026, 6, 15)
        )

        #expect(absent == zero)
    }

    @Test("returns nil when the initial amount already covers the target — nothing to decompose")
    func suggestion_nilWhenInitialAmountCoversTarget() {
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 10_000,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            initialAmount: 10_000,
            now: Self.date(2026, 6, 15)
        ) == nil)
    }

    @Test("uses the cent gap when the initial amount nearly covers the target")
    func suggestion_usesCentGap() {
        let targetDate = Self.date(2026, 6, 15)
        let now = Self.date(2026, 6, 15)

        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100,
            targetDate: targetDate,
            payDayOfMonth: nil,
            initialAmount: Decimal(string: "99.99") ?? 0,
            now: now
        ) == Decimal(string: "0.01"))
        #expect(SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 100,
            targetDate: targetDate,
            payDayOfMonth: nil,
            initialAmount: Decimal(string: "99.999") ?? 0,
            now: now
        ) == nil)
    }

    @Test("starts the contribution window at the later explicit start period")
    func suggestion_anchorsAtExplicitStartDate() {
        let suggestion = SavingsPlanCalculator.suggestedMonthlyContribution(
            targetAmount: 1_400,
            targetDate: Self.date(2026, 12, 15),
            payDayOfMonth: nil,
            startDate: Self.date(2026, 6, 15),
            now: Self.date(2026, 5, 15)
        )

        #expect(suggestion == 200)
    }
}
