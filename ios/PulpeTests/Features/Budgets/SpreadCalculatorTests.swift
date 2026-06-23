import Foundation
@testable import Pulpe
import Testing

/// PUL-17 Lot A — the reactive "Lisser" calculator (interpretation B: montant/mois
/// répliqué). These tests pin the tranche/month math: window enumeration, per-month
/// deselection WITHOUT redistribution, the 36-month cap, inverted-window blocking,
/// the empty-selection block, and the `total = perMonth × selectedCount` echo.
@Suite("SpreadCalculator")
@MainActor
struct SpreadCalculatorTests {
    // MARK: - Window enumeration ([De, À] range)

    @Test func defaultWindow_isAnchorPlusTwoFollowingMonths() {
        let sut = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)

        #expect(sut.start == SpreadMonth(year: 2026, month: 6))
        #expect(sut.end == SpreadMonth(year: 2026, month: 8))
        #expect(sut.windowMonths == [
            SpreadMonth(year: 2026, month: 6),
            SpreadMonth(year: 2026, month: 7),
            SpreadMonth(year: 2026, month: 8),
        ])
    }

    @Test func anchor_usesPassedPeriod_notDeviceCurrentMonth() {
        // PUL-17 P1: opening the add sheet from a budget whose month differs from
        // the device's current month must anchor the spread to the OPENED budget's
        // period, not `Date()`. The window then starts on that month (+2 following).
        let sut = SpreadCalculator(anchorMonth: 3, anchorYear: 2026)

        #expect(sut.start == SpreadMonth(year: 2026, month: 3))
        #expect(sut.windowMonths == [
            SpreadMonth(year: 2026, month: 3),
            SpreadMonth(year: 2026, month: 4),
            SpreadMonth(year: 2026, month: 5),
        ])
        // The very first tranche lands in the anchored month, never in `Date()`.
        #expect(sut.buildTranches(amount: 100).first?.month == 3)
        #expect(sut.buildTranches(amount: 100).first?.year == 2026)
    }

    @Test func windowMonths_enumeratesEveryMonthInclusiveAcrossYearBoundary() {
        let sut = SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2027, month: 2))

        #expect(sut.windowMonths == [
            SpreadMonth(year: 2026, month: 11),
            SpreadMonth(year: 2026, month: 12),
            SpreadMonth(year: 2027, month: 1),
            SpreadMonth(year: 2027, month: 2),
        ])
    }

    @Test func windowMonths_singleMonthWindow_yieldsExactlyThatMonth() {
        let sut = SpreadCalculator(anchorMonth: 3, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 3))

        #expect(sut.windowMonths == [SpreadMonth(year: 2026, month: 3)])
        #expect(sut.selectedCount == 1)
    }

    // MARK: - Deselection drops exactly one month, no redistribution

    @Test func toggle_deselectingMonth_dropsExactlyThatMonth() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 4)) // Jan..Apr = 4 months

        sut.toggle(SpreadMonth(year: 2026, month: 2)) // deselect February

        #expect(sut.selectedMonths == [
            SpreadMonth(year: 2026, month: 1),
            SpreadMonth(year: 2026, month: 3),
            SpreadMonth(year: 2026, month: 4),
        ])
        #expect(sut.selectedCount == 3)
        // The window itself is unchanged — only the selection shrank.
        #expect(sut.windowMonths.count == 4)
    }

    @Test func toggle_deselection_doesNotRedistributePerMonthAmount() {
        // Interpretation B: every remaining month keeps the SAME per-month amount.
        // Deselecting a month must NOT bump the others to "absorb" the gap.
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 3)) // 3 months
        let perMonth: Decimal = 100

        let before = sut.buildTranches(amount: perMonth)
        sut.toggle(SpreadMonth(year: 2026, month: 2)) // drop the middle month
        let after = sut.buildTranches(amount: perMonth)

        #expect(before.count == 3)
        #expect(after.count == 2)
        // Each surviving tranche still carries the original per-month amount.
        #expect(after.allSatisfy { $0.amount == perMonth })
        // The total dropped by exactly one tranche's worth (no redistribution).
        #expect(sut.total(amountPerMonth: perMonth) == 200)
    }

    @Test func toggle_isReversible_reselectingRestoresTheMonth() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 3))
        let february = SpreadMonth(year: 2026, month: 2)

        sut.toggle(february)
        #expect(sut.isSelected(february) == false)
        #expect(sut.selectedCount == 2)

        sut.toggle(february)
        #expect(sut.isSelected(february) == true)
        #expect(sut.selectedCount == 3)
    }

    @Test func setEnd_pruningWindow_forgetsDeselectionsOutsideNewWindow() {
        // A month deselected then pushed out of the window must not "stick" as a
        // phantom deselection if the window later grows back over it.
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 4))
        let april = SpreadMonth(year: 2026, month: 4)

        sut.toggle(april) // deselect April
        sut.setEnd(SpreadMonth(year: 2026, month: 2)) // shrink window past April
        sut.setEnd(SpreadMonth(year: 2026, month: 4)) // grow back over April

        #expect(sut.isSelected(april) == true)
        #expect(sut.selectedCount == 4)
    }

    // MARK: - Total echo = perMonth × selectedCount

    @Test func total_echoesPerMonthTimesSelectedCount() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 5)) // 5 months

        #expect(sut.total(amountPerMonth: 250) == 1250)

        sut.toggle(SpreadMonth(year: 2026, month: 3)) // drop one → 4 months
        #expect(sut.total(amountPerMonth: 250) == 1000)
    }

    @Test func total_withZeroPerMonth_isZero() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 6))

        #expect(sut.total(amountPerMonth: 0) == 0)
    }

    // MARK: - Validation: inverted window (end < start)

    @Test func validation_endBeforeStart_isBlocked() {
        let sut = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 3)) // March < June

        #expect(sut.isValid == false)
        #expect(sut.validationMessage == "Le mois de fin précède le mois de début")
        #expect(sut.windowMonths.isEmpty)
        #expect(sut.selectedCount == 0)
    }

    // MARK: - Validation: 36-month cap

    @Test func validation_exactly36Months_isValid() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        // Jan 2026 → Dec 2028 inclusive = 36 months.
        sut.setEnd(SpreadMonth(year: 2028, month: 12))

        #expect(sut.windowMonths.count == 36)
        #expect(sut.isValid == true)
        #expect(sut.validationMessage == nil)
    }

    @Test func validation_37Months_exceedsCapAndIsBlocked() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        // Jan 2026 → Jan 2029 inclusive = 37 months.
        sut.setEnd(SpreadMonth(year: 2029, month: 1))

        #expect(sut.windowMonths.count == 37)
        #expect(sut.isValid == false)
        #expect(sut.validationMessage == "36 mois maximum")
    }

    @Test func maxMonths_constantMatchesBackendContract() {
        // Mirrors MAX_SPREAD_TRANCHES on the backend.
        #expect(SpreadCalculator.maxMonths == 36)
    }

    // MARK: - Validation: no month selected

    @Test func validation_allMonthsDeselected_isBlocked() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 2)) // 2 months

        sut.toggle(SpreadMonth(year: 2026, month: 1))
        sut.toggle(SpreadMonth(year: 2026, month: 2))

        #expect(sut.selectedCount == 0)
        #expect(sut.isValid == false)
        #expect(sut.validationMessage == "Sélectionne au moins un mois")
    }

    @Test func validation_oneMonthSelected_isValid() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 2))

        sut.toggle(SpreadMonth(year: 2026, month: 2)) // drop one, keep one

        #expect(sut.selectedCount == 1)
        #expect(sut.isValid == true)
        #expect(sut.validationMessage == nil)
    }

    // MARK: - buildTranches output

    @Test func buildTranches_emitsOneConcreteTranchePerSelectedMonth() {
        let sut = SpreadCalculator(anchorMonth: 11, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2027, month: 1)) // Nov, Dec, Jan

        let tranches = sut.buildTranches(amount: 80)

        #expect(tranches.count == 3)
        #expect(tranches.map { Pair($0.year, $0.month) } == [
            Pair(2026, 11), Pair(2026, 12), Pair(2027, 1),
        ])
        #expect(tranches.allSatisfy { $0.amount == 80 })
        // No FX → originalAmount stays nil on every tranche.
        #expect(tranches.allSatisfy { $0.originalAmount == nil })
    }

    @Test func buildTranches_withOriginalAmount_setsItOnEveryTranche() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 2))

        let tranches = sut.buildTranches(amount: 93, originalAmount: 100)

        #expect(tranches.count == 2)
        #expect(tranches.allSatisfy { $0.amount == 93 })
        #expect(tranches.allSatisfy { $0.originalAmount == 100 })
    }

    @Test func buildTranches_skipsDeselectedMonths() {
        let sut = SpreadCalculator(anchorMonth: 1, anchorYear: 2026)
        sut.setEnd(SpreadMonth(year: 2026, month: 3))
        sut.toggle(SpreadMonth(year: 2026, month: 2))

        let tranches = sut.buildTranches(amount: 50)

        #expect(tranches.map { Pair($0.year, $0.month) } == [Pair(2026, 1), Pair(2026, 3)])
    }
}

// MARK: - SpreadMonth ordinal/range maths

@Suite("SpreadMonth")
struct SpreadMonthTests {
    @Test func ordinal_isStrictlyMonotonicAcrossYearBoundary() {
        let dec = SpreadMonth(year: 2026, month: 12)
        let jan = SpreadMonth(year: 2027, month: 1)

        #expect(jan.ordinal == dec.ordinal + 1)
    }

    @Test func fromOrdinal_roundTripsWithOrdinal() {
        let month = SpreadMonth(year: 2026, month: 6)
        #expect(SpreadMonth.from(ordinal: month.ordinal) == month)
    }

    @Test func range_isEmptyWhenEndPrecedesStart() {
        let start = SpreadMonth(year: 2026, month: 6)
        let end = SpreadMonth(year: 2026, month: 3)

        #expect(SpreadMonth.range(from: start, to: end).isEmpty)
    }

    @Test func range_inclusiveAcrossYearBoundary() {
        let start = SpreadMonth(year: 2026, month: 12)
        let end = SpreadMonth(year: 2027, month: 1)

        #expect(SpreadMonth.range(from: start, to: end) == [
            SpreadMonth(year: 2026, month: 12),
            SpreadMonth(year: 2027, month: 1),
        ])
    }
}

/// Lightweight, order-stable comparison helper so tranche year/month assertions
/// read clearly in failure output.
private struct Pair: Equatable {
    let year: Int
    let month: Int
    init(_ year: Int, _ month: Int) {
        self.year = year
        self.month = month
    }
}
