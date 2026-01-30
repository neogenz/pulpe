import XCTest
@testable import Pulpe

final class StringParsedAsAmountTests: XCTestCase {

    // MARK: - Valid Amounts

    func testValidInteger() {
        XCTAssertEqual("42".parsedAsAmount, Decimal(42))
    }

    func testValidDecimalWithDot() {
        XCTAssertEqual("12.50".parsedAsAmount, Decimal(string: "12.50"))
    }

    func testValidDecimalWithComma() {
        XCTAssertEqual("12,50".parsedAsAmount, Decimal(string: "12.50"))
    }

    func testSingleDigit() {
        XCTAssertEqual("5".parsedAsAmount, Decimal(5))
    }

    func testLargeAmount() {
        XCTAssertEqual("9999".parsedAsAmount, Decimal(9999))
    }

    // MARK: - Fractional Digit Limiting

    func testLimitsToTwoFractionalDigits() {
        XCTAssertEqual("10.999".parsedAsAmount, Decimal(string: "10.99"))
    }

    func testOneFractionalDigit() {
        XCTAssertEqual("10.5".parsedAsAmount, Decimal(string: "10.5"))
    }

    func testExactlyTwoFractionalDigits() {
        XCTAssertEqual("10.55".parsedAsAmount, Decimal(string: "10.55"))
    }

    // MARK: - Empty and Invalid Input

    func testEmptyString() {
        XCTAssertNil("".parsedAsAmount)
    }

    func testOnlyLetters() {
        XCTAssertNil("abc".parsedAsAmount)
    }

    func testMixedLettersAndNumbers() {
        XCTAssertEqual("1a2b3".parsedAsAmount, Decimal(123))
    }

    // MARK: - Edge Cases

    func testLeadingZero() {
        XCTAssertEqual("0.50".parsedAsAmount, Decimal(string: "0.50"))
    }

    func testZero() {
        XCTAssertEqual("0".parsedAsAmount, Decimal(0))
    }

    func testDotOnly() {
        // Swift's Decimal(string: ".") returns Decimal(0)
        XCTAssertEqual(".".parsedAsAmount, Decimal(0))
    }

    func testMultipleDots() {
        // "12.3.4" → cleaned = "12.3.4", components = ["12", "3", "4"]
        // fractional = "34".prefix(2) = "34" → "12.34"
        XCTAssertEqual("12.3.4".parsedAsAmount, Decimal(string: "12.34"))
    }
}
