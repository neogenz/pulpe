import Foundation
@testable import Pulpe
import Testing

struct CheckedFilterPickerTests {
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
        #expect(option.label == "Tout voir")
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
        #expect(option.accessibilityLabel == "Afficher uniquement les éléments à pointer")
    }

    @Test func allOptionHasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        #expect(option.accessibilityLabel == "Afficher tous les éléments")
    }

    @Test func checkedOptionHasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.checked

        // Assert
        #expect(option.label == "Pointé")
    }

    @Test func checkedOptionHasCorrectIcon() {
        // Arrange
        let option = CheckedFilterOption.checked

        // Assert
        #expect(option.icon == "checkmark.square")
    }

    @Test func checkedOptionHasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.checked

        // Assert
        #expect(option.accessibilityLabel == "Afficher uniquement les éléments pointés")
    }

    // MARK: - CaseIterable

    @Test func allCasesContainsAllOptions() {
        // Arrange & Act
        let allCases = CheckedFilterOption.allCases

        // Assert
        #expect(allCases.count == 3)
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
}
