import Foundation
@testable import Pulpe
import SwiftUI
import Testing

struct CheckedFilterOptionTests {
    // MARK: - Filter Option Properties

    @Test func uncheckedOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.label == "À pointer")
    }

    @Test func allOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.label == "Tout")
    }

    // MARK: - Accessibility Labels

    @Test func checkedOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.checked

        // Assert
        #expect(option.label == "Pointé")
    }

    // MARK: - CaseIterable

    @Test func allCasesContainsAllOptions() {
        // Arrange & Act
        let allCases = CheckedFilterOption.allCases

        // Assert
        #expect(allCases.count == 4)
        #expect(allCases.contains(.over))
        #expect(allCases.contains(.unchecked))
        #expect(allCases.contains(.checked))
        #expect(allCases.contains(.all))
    }

    // MARK: - Identifiable

    @Test func idMatchesRawValue() {
        // Arrange
        let unchecked = CheckedFilterOption.unchecked
        let checked = CheckedFilterOption.checked
        let all = CheckedFilterOption.all

        // Assert
        #expect(unchecked.id == "unchecked")
        #expect(checked.id == "checked")
        #expect(all.id == "all")
    }

    // MARK: - Raw Value

    @Test func rawValueUnchecked() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.rawValue == "unchecked")
    }

    @Test func rawValueChecked() {
        // Arrange
        let option = CheckedFilterOption.checked

        // Assert
        #expect(option.rawValue == "checked")
    }

    @Test func rawValueAll() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.rawValue == "all")
    }

    @Test func initFromRawValueValid() {
        // Arrange & Act
        let unchecked = CheckedFilterOption(rawValue: "unchecked")
        let checked = CheckedFilterOption(rawValue: "checked")
        let all = CheckedFilterOption(rawValue: "all")

        // Assert
        #expect(unchecked == .unchecked)
        #expect(checked == .checked)
        #expect(all == .all)
    }

    @Test func initFromRawValueInvalidReturnsNil() {
        // Arrange & Act
        let invalid = CheckedFilterOption(rawValue: "invalid")

        // Assert
        #expect(invalid == nil)
    }

    // MARK: - Dépassées

    @MainActor @Test func overOptionKeepsOnlyLinesPastTheirPlan() {
        let over = TestDataFactory.createBudgetLine(id: "over", amount: 100, kind: .expense)
        let within = TestDataFactory.createBudgetLine(id: "within", amount: 100, kind: .expense)
        let consumption: [String: BudgetFormulas.Consumption] = [
            "over": .init(allocated: 130, available: -30, percentage: 130),
            "within": .init(allocated: 40, available: 60, percentage: 40),
        ]

        let shown = FiltersStore.applyCheckedFilter([over, within], filter: .over, consumptionByLineId: consumption)
        let counts = FiltersStore.checkedCounts(for: [over, within], typeFilter: .all, consumptionByLineId: consumption)

        #expect(shown.map(\.id) == ["over"])
        #expect(counts.count(for: .over) == 1)
        #expect(CheckedFilterOption.over.label == "Dépassées")
    }
}
