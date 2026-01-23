import XCTest
@testable import Pulpe

/// Tests for CheckedFilterPicker behavior
/// Focuses on filter options and accessibility labels
final class CheckedFilterPickerTests: XCTestCase {

    // MARK: - Filter Option Properties

    func testUncheckedOption_hasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        XCTAssertEqual(option.label, "Non comptabilisées")
    }

    func testAllOption_hasCorrectLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        XCTAssertEqual(option.label, "Toutes")
    }

    func testUncheckedOption_hasCorrectIcon() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        XCTAssertEqual(option.icon, "square")
    }

    func testAllOption_hasCorrectIcon() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        XCTAssertEqual(option.icon, "list.bullet")
    }

    // MARK: - Accessibility Labels

    func testUncheckedOption_hasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        XCTAssertEqual(
            option.accessibilityLabel,
            "Afficher uniquement les éléments non comptabilisés"
        )
    }

    func testAllOption_hasAccessibilityLabel() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        XCTAssertEqual(
            option.accessibilityLabel,
            "Afficher tous les éléments"
        )
    }

    // MARK: - CaseIterable

    func testAllCases_containsBothOptions() {
        // Arrange & Act
        let allCases = CheckedFilterOption.allCases

        // Assert
        XCTAssertEqual(allCases.count, 2)
        XCTAssertTrue(allCases.contains(.unchecked))
        XCTAssertTrue(allCases.contains(.all))
    }

    // MARK: - Identifiable

    func testId_matchesRawValue() {
        // Arrange
        let unchecked = CheckedFilterOption.unchecked
        let all = CheckedFilterOption.all

        // Assert
        XCTAssertEqual(unchecked.id, "unchecked")
        XCTAssertEqual(all.id, "all")
    }

    // MARK: - Raw Value

    func testRawValue_unchecked() {
        // Arrange
        let option = CheckedFilterOption.unchecked

        // Assert
        XCTAssertEqual(option.rawValue, "unchecked")
    }

    func testRawValue_all() {
        // Arrange
        let option = CheckedFilterOption.all

        // Assert
        XCTAssertEqual(option.rawValue, "all")
    }

    func testInitFromRawValue_valid() {
        // Arrange & Act
        let unchecked = CheckedFilterOption(rawValue: "unchecked")
        let all = CheckedFilterOption(rawValue: "all")

        // Assert
        XCTAssertEqual(unchecked, .unchecked)
        XCTAssertEqual(all, .all)
    }

    func testInitFromRawValue_invalid_returnsNil() {
        // Arrange & Act
        let invalid = CheckedFilterOption(rawValue: "invalid")

        // Assert
        XCTAssertNil(invalid)
    }
}
