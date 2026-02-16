import Foundation
import Testing
@testable import Pulpe

struct BudgetServiceTests {

    private let sut = BudgetService.shared

    // MARK: - getNextAvailableMonth Tests

    @Test
    func getNextAvailableMonth_withNoBudgets_returnsCurrentMonth() {
        let emptyBudgets: [Budget] = []
        let now = Date()
        let expectedMonth = now.month
        let expectedYear = now.year

        let result = sut.getNextAvailableMonth(existingBudgets: emptyBudgets)

        #expect(result != nil)
        #expect(result?.month == expectedMonth)
        #expect(result?.year == expectedYear)
    }

    @Test
    func getNextAvailableMonth_whenCurrentMonthTaken_returnsNextMonth() {
        let now = Date()
        let currentMonthBudget = TestDataFactory.createBudget(
            month: now.month,
            year: now.year
        )

        let result = sut.getNextAvailableMonth(existingBudgets: [currentMonthBudget])

        #expect(result != nil)

        let isSameMonth = result?.month == now.month && result?.year == now.year
        #expect(!isSameMonth)

        if let resultMonth = result?.month, let resultYear = result?.year {
            #expect(resultYear > now.year || (resultYear == now.year && resultMonth > now.month))
        }
    }

    @Test
    func getNextAvailableMonth_skipsMultipleTakenMonths() {
        let now = Date()
        let calendar = Calendar.current

        var takenBudgets: [Budget] = []
        for offset in 0..<3 {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                takenBudgets.append(budget)
            }
        }

        let result = sut.getNextAvailableMonth(existingBudgets: takenBudgets)

        #expect(result != nil)

        let isTaken = takenBudgets.contains { budget in
            budget.month == result?.month && budget.year == result?.year
        }
        #expect(!isTaken)
    }

    @Test
    func getNextAvailableMonth_findsGapInMiddleOfSequence() {
        let now = Date()
        let calendar = Calendar.current

        var budgetsWithGap: [Budget] = []
        for offset in [0, 1, 3] {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                budgetsWithGap.append(budget)
            }
        }

        let result = sut.getNextAvailableMonth(existingBudgets: budgetsWithGap)

        #expect(result != nil)

        if let expectedDate = calendar.date(byAdding: .month, value: 2, to: now) {
            #expect(result?.month == expectedDate.month)
            #expect(result?.year == expectedDate.year)
        }
    }

    @Test
    func getNextAvailableMonth_handlesYearTransition() {
        let decemberBudget = TestDataFactory.createBudget(month: 12, year: 2025)

        let result = sut.getNextAvailableMonth(existingBudgets: [decemberBudget])

        #expect(result != nil)
        if let result = result {
            let isValid = (result.year == 2025 && result.month != 12) || result.year >= 2026
            #expect(isValid)
        }
    }

    @Test
    func getNextAvailableMonth_respectsMaxYearsAheadLimit() {
        let now = Date()
        let calendar = Calendar.current
        let maxYears = AppConfiguration.maxBudgetYearsAhead

        var allBudgets: [Budget] = []
        for monthOffset in 0..<(maxYears * 12) {
            if let date = calendar.date(byAdding: .month, value: monthOffset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(monthOffset)",
                    month: date.month,
                    year: date.year
                )
                allBudgets.append(budget)
            }
        }

        let result = sut.getNextAvailableMonth(existingBudgets: allBudgets)

        #expect(result == nil)
    }

    @Test
    func getNextAvailableMonth_withRandomlyDistributedBudgets_findsFirstGap() {
        let now = Date()
        let calendar = Calendar.current

        var sparselyDistributed: [Budget] = []
        for offset in stride(from: 0, to: 8, by: 2) {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                sparselyDistributed.append(budget)
            }
        }

        let result = sut.getNextAvailableMonth(existingBudgets: sparselyDistributed)

        #expect(result != nil)

        if let expectedDate = calendar.date(byAdding: .month, value: 1, to: now) {
            #expect(result?.month == expectedDate.month)
            #expect(result?.year == expectedDate.year)
        }
    }

    @Test
    func getNextAvailableMonth_returnsFirstAvailableNotLastInSequence() {
        let now = Date()
        let calendar = Calendar.current

        var futureBudgets: [Budget] = []
        for offset in 1...2 {
            if let date = calendar.date(byAdding: .month, value: offset, to: now) {
                let budget = TestDataFactory.createBudget(
                    id: "budget-\(offset)",
                    month: date.month,
                    year: date.year
                )
                futureBudgets.append(budget)
            }
        }

        let result = sut.getNextAvailableMonth(existingBudgets: futureBudgets)

        #expect(result != nil)
        #expect(result?.month == now.month)
        #expect(result?.year == now.year)
    }

    // MARK: - Edge Cases

    @Test
    func getNextAvailableMonth_withDuplicateBudgets_stillFindsGap() {
        let now = Date()

        let budget1 = TestDataFactory.createBudget(id: "budget-1", month: now.month, year: now.year)
        let budget2 = TestDataFactory.createBudget(id: "budget-2", month: now.month, year: now.year)

        let result = sut.getNextAvailableMonth(existingBudgets: [budget1, budget2])

        #expect(result != nil)

        let isNotCurrent = result?.month != now.month || result?.year != now.year
        #expect(isNotCurrent)
    }
}
