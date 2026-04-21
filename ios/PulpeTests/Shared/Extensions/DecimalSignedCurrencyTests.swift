import Foundation
@testable import Pulpe
import Testing

@Suite("Decimal asSignedCurrency / asSignedCompactCurrency")
struct DecimalSignedCurrencyTests {
    // MARK: - asSignedCurrency (CHF)

    @Test func signedCurrency_positiveCHF_prependsPlusAndKeepsCode() {
        let value: Decimal = 1234.56
        let formatted = value.asSignedCurrency(.chf)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("CHF"))
    }

    @Test func signedCurrency_negativeCHF_prependsMinusAndKeepsCode() {
        let value: Decimal = -1234.56
        let formatted = value.asSignedCurrency(.chf)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
    }

    @Test func signedCurrency_zeroCHF_noSignPrefix() {
        let value: Decimal = 0
        let formatted = value.asSignedCurrency(.chf)

        #expect(!formatted.hasPrefix("+"))
        #expect(!formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
    }

    // MARK: - asSignedCurrency (EUR)

    @Test func signedCurrency_positiveEUR_prependsPlusAndUsesEuroSign() {
        let value: Decimal = 1234.56
        let formatted = value.asSignedCurrency(.eur)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
    }

    @Test func signedCurrency_negativeEUR_prependsMinusAndUsesEuroSign() {
        let value: Decimal = -1234.56
        let formatted = value.asSignedCurrency(.eur)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
    }

    // MARK: - asSignedCompactCurrency (CHF)

    @Test func signedCompactCurrency_positiveCHF_prependsPlusAndRounds() {
        let value: Decimal = 1234.56
        let formatted = value.asSignedCompactCurrency(.chf)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(!formatted.contains("."))
        #expect(!formatted.contains(","))
    }

    @Test func signedCompactCurrency_negativeCHF_prependsMinusAndRounds() {
        let value: Decimal = -500.8
        let formatted = value.asSignedCompactCurrency(.chf)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(!formatted.contains("."))
        #expect(!formatted.contains(","))
    }

    @Test func signedCompactCurrency_zeroCHF_noSignPrefix() {
        let value: Decimal = 0
        let formatted = value.asSignedCompactCurrency(.chf)

        #expect(!formatted.hasPrefix("+"))
        #expect(!formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
    }

    // MARK: - asSignedCompactCurrency (EUR)

    @Test func signedCompactCurrency_positiveEUR_prependsPlusAndUsesEuroSign() {
        let value: Decimal = 1234.56
        let formatted = value.asSignedCompactCurrency(.eur)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
        #expect(!formatted.contains("."))
        #expect(!formatted.contains(","))
    }

    @Test func signedCompactCurrency_negativeEUR_prependsMinusAndUsesEuroSign() {
        let value: Decimal = -500.8
        let formatted = value.asSignedCompactCurrency(.eur)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
    }
}
