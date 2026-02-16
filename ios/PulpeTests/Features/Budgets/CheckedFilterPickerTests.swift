import Foundation
import Testing
@testable import Pulpe

struct CheckedFilterPickerTests {

    // MARK: - Filter Option Properties

    @Test func uncheckedOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.label == "Non comptabilisées")
    }

    @Test func allOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.label == "Toutes")
    }

    @Test func uncheckedOptionHasCorrectIcon() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.icon == "square")
    }

    @Test func allOptionHasCorrectIcon() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.icon == "list.bullet")
    }

    // MARK: - Accessibility Labels

    @Test func uncheckedOptionHasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.accessibilityLabel == "Afficher uniquement les éléments non comptabilisés")
    }

    @Test func allOptionHasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.accessibilityLabel == "Afficher tous les éléments")
    }

    // MARK: - CaseIterable

    @Test func allCasesContainsBothOptions() {
        // Arrange & Act
        let allCases = CheckedFilterOption.allCases

        // Assert
        #expect(allCases.count == 2)
        #expect(allCases.contains(.unchecked))
        #expect(allCases.contains(.all))
    }

    // MARK: - Identifiable

    @Test func idMatchesRawValue() {
        // Arrange
        let unchecked = CheckedFilterOption.unchecked
        let all = CheckedFilterOption.all

        // Assert
        #expect(unchecked.id == "unchecked")
        #expect(all.id == "all")
    }

    // MARK: - Raw Value

    @Test func rawValueUnchecked() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        #expect(option.rawValue == "unchecked")
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
        let all = CheckedFilterOption(rawValue: "all")

        // Assert
        #expect(unchecked == .unchecked)
        #expect(all == .all)
    }

    @Test func initFromRawValueInvalidReturnsNil() {
        // Arrange & Act
        let invalid = CheckedFilterOption(rawValue: "invalid")

        // Assert
        #expect(invalid == nil)
    }
}
