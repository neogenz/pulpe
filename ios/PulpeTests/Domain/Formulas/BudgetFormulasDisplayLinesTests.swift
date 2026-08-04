import Foundation
@testable import Pulpe
import Testing

/// A rollover is carried on the budget, not on a stored line: the display list
/// prepends a virtual one so the month opens on what the previous one left.
struct BudgetFormulasDisplayLinesTests {
    @Test func displayBudgetLines_withNoRollover_returnsOriginalLines() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1"),
            TestDataFactory.createBudgetLine(id: "line-2")
        ]
        let budget = TestDataFactory.createBudget(rollover: 0)

        // Act
        let displayLines = BudgetFormulas.displayBudgetLines(base: lines, budget: budget)

        // Assert
        #expect(displayLines.count == 2)
        #expect(displayLines.map { $0.id } == ["line-1", "line-2"])
    }

    @Test func displayBudgetLines_withPositiveRollover_prependsRolloverLine() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1"),
            TestDataFactory.createBudgetLine(id: "line-2")
        ]
        let budget = TestDataFactory.createBudget(rollover: 500)

        // Act
        let displayLines = BudgetFormulas.displayBudgetLines(base: lines, budget: budget)

        // Assert
        #expect(displayLines.count == 3)
        #expect(displayLines[0].isVirtualRollover)
        #expect(displayLines[0].amount == 500)
        #expect(displayLines[0].kind == .income)
    }

    /// A deficit carries over as an expense of the same magnitude — the sign
    /// lives in the kind, never in the amount.
    @Test func displayBudgetLines_withNegativeRollover_prependsNegativeRolloverLine() {
        // Arrange
        let lines = [
            TestDataFactory.createBudgetLine(id: "line-1")
        ]
        let budget = TestDataFactory.createBudget(rollover: -300)

        // Act
        let displayLines = BudgetFormulas.displayBudgetLines(base: lines, budget: budget)

        // Assert
        #expect(displayLines.count == 2)
        #expect(displayLines[0].isVirtualRollover)
        #expect(displayLines[0].amount == 300)
        #expect(displayLines[0].kind == .expense)
    }
}
