import Foundation
import Testing
@testable import Pulpe

struct StringParsedAsAmountTests {

    // MARK: - Valid Amounts

    @Test func validInteger() {
        #expect("42".parsedAsAmount == Decimal(42))
    }

    @Test func validDecimalWithDot() {
        #expect("12.50".parsedAsAmount == Decimal(string: "12.50"))
    }

    @Test func validDecimalWithComma() {
        #expect("12,50".parsedAsAmount == Decimal(string: "12.50"))
    }

    @Test func singleDigit() {
        #expect("5".parsedAsAmount == Decimal(5))
    }

    @Test func largeAmount() {
        #expect("9999".parsedAsAmount == Decimal(9999))
    }

    // MARK: - Fractional Digit Limiting

    @Test func limitsToTwoFractionalDigits() {
        #expect("10.999".parsedAsAmount == Decimal(string: "10.99"))
    }

    @Test func oneFractionalDigit() {
        #expect("10.5".parsedAsAmount == Decimal(string: "10.5"))
    }

    @Test func exactlyTwoFractionalDigits() {
        #expect("10.55".parsedAsAmount == Decimal(string: "10.55"))
    }

    // MARK: - Empty and Invalid Input

    @Test func emptyString() {
        #expect("".parsedAsAmount == nil)
    }

    @Test func onlyLetters() {
        #expect("abc".parsedAsAmount == nil)
    }

    @Test func mixedLettersAndNumbers() {
        #expect("1a2b3".parsedAsAmount == Decimal(123))
    }

    // MARK: - Edge Cases

    @Test func leadingZero() {
        #expect("0.50".parsedAsAmount == Decimal(string: "0.50"))
    }

    @Test func zero() {
        #expect("0".parsedAsAmount == Decimal(0))
    }

    @Test func dotOnly() {
        #expect(".".parsedAsAmount == Decimal(0))
    }

    @Test func multipleDots() {
        #expect("12.3.4".parsedAsAmount == Decimal(string: "12.34"))
    }
}
