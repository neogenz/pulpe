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

    @Test func wholePositive_omitsDecimals() {
        let value: Decimal = 100
        #expect(value.asSignedCompactCHF == "+100 CHF")
    }

    @Test func fractional_roundsToWholeNumber() {
        let value: Decimal = 1309.02
        #expect(value.asCompactCHF == "1\u{2019}309 CHF")
    }

    // MARK: - asSignedCompactAmount

    @Test func signedCompactAmount_negative_prependsMinus() {
        let value: Decimal = -500
        #expect(value.asSignedCompactAmount == "-500")
    }

    @Test func signedCompactAmount_positive_prependsPlus() {
        let value: Decimal = 500
        #expect(value.asSignedCompactAmount == "+500")
    }

    @Test func signedCompactAmount_zero_noSign() {
        let value: Decimal = 0
        #expect(value.asSignedCompactAmount == "0")
    }
}
