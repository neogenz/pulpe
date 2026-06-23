import Foundation
@testable import Pulpe
import Testing

/// PUL-17 v1.1 — the total-preserving "lisser un existant" calculator: M0-locked
/// window, N ≥ 2, and the split-driven echo (per-month base + remainder month).
@Suite("SpreadExistingCalculator")
@MainActor
struct SpreadExistingCalculatorTests {
    private func make(month: Int = 6, year: Int = 2026) -> SpreadExistingCalculator {
        SpreadExistingCalculator(anchorMonth: month, anchorYear: year)
    }

    @Test func defaultWindow_isThreeMonthsFromAnchor() {
        let calc = make()
        #expect(calc.windowMonths.map(\.month) == [6, 7, 8])
        #expect(calc.selectedCount == 3)
    }

    @Test func m0_isLocked_andNotDeselectable() {
        let calc = make()
        #expect(calc.isLocked(calc.start))
        calc.toggle(calc.start)
        #expect(calc.isSelected(calc.start))
        #expect(calc.selectedCount == 3)
    }

    @Test func toggle_deselectsNonAnchorMonth() {
        let calc = make()
        let july = SpreadMonth(year: 2026, month: 7)
        calc.toggle(july)
        #expect(!calc.isSelected(july))
        #expect(calc.selectedCount == 2)
    }

    @Test func setEnd_extendsWindow_andPrunesOutOfRangeDeselections() {
        let calc = make()
        calc.toggle(SpreadMonth(year: 2026, month: 8))
        #expect(calc.selectedCount == 2)
        calc.setEnd(SpreadMonth(year: 2026, month: 7))
        #expect(calc.windowMonths.map(\.month) == [6, 7])
        #expect(calc.selectedCount == 2)   // August deselection pruned
    }

    @Test func validation_invertedWindow() {
        let calc = make()
        calc.setEnd(SpreadMonth(year: 2026, month: 5))
        #expect(calc.validationMessage == "Le mois de fin précède le mois de début")
        #expect(!calc.isValid)
    }

    @Test func validation_singleMonth_requiresTwo() {
        let calc = make()
        calc.toggle(SpreadMonth(year: 2026, month: 7))
        calc.toggle(SpreadMonth(year: 2026, month: 8))
        #expect(calc.selectedCount == 1)
        #expect(calc.validationMessage == "Choisis au moins deux mois")
    }

    @Test func validation_exceeds36Months() {
        let calc = make(month: 1, year: 2026)
        calc.setEnd(SpreadMonth(year: 2029, month: 12))
        #expect(calc.validationMessage == "36 mois maximum")
    }

    @Test func perMonth_isBaseTranche() {
        let calc = make()  // 3 months → 100/3 base 33.33 (remainder on M0)
        #expect(calc.perMonth(total: 100) == Decimal(string: "33.33"))
    }

    @Test func remainderMonthName_namesLastRemainderMonth() {
        let calc = make()  // [Juin, Juillet, Août], 100/3 → 1 cent on Juin
        #expect(calc.remainderMonthName(total: 100) == "Juin")
    }

    @Test func remainderMonthName_nilForExactSplit() {
        let calc = make()
        calc.setEnd(SpreadMonth(year: 2026, month: 9))  // 4 months, 100/4 = 25 exact
        #expect(calc.remainderMonthName(total: 100) == nil)
    }

    @Test func periods_areAscending_includingM0() {
        let calc = make()
        let periods = calc.periods()
        #expect(periods.map(\.month) == [6, 7, 8])
        let allIn2026 = periods.allSatisfy { $0.year == 2026 }
        #expect(allIn2026)
    }
}
