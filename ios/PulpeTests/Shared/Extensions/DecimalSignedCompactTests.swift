import Foundation
@testable import Pulpe
import Testing

@Suite("Decimal asSignedCompactCHF")
struct DecimalSignedCompactTests {
    @Test func positive_prependsPlus() {
        let value: Decimal = 1234.56
        #expect(value.asSignedCompactCHF == "+1\u{2019}235 CHF")
    }

    @Test func negative_prependsMinus() {
        let value: Decimal = -500.8
        #expect(value.asSignedCompactCHF == "-501 CHF")
    }

    @Test func zero_noSign() {
        let value: Decimal = 0
        #expect(value.asSignedCompactCHF == "0 CHF")
    }

    @Test func smallPositive_roundsUp() {
        let value: Decimal = 0.6
        #expect(value.asSignedCompactCHF == "+1 CHF")
    }

    @Test func smallNegative_roundsDown() {
        let value: Decimal = -0.4
        // -0.4 rounded plain = 0, so it becomes "0 CHF" with no sign
        #expect(value.asSignedCompactCHF == "0 CHF")
    }

    @Test func asCompactCHF_alwaysRoundedWholeNumber() {
        let value: Decimal = 1309.02
        #expect(value.asCompactCHF == "1\u{2019}309 CHF")
    }
}
