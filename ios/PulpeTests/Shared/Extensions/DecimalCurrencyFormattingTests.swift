import Foundation
@testable import Pulpe
import Testing

/// Regression tests for CHF currency formatting.
/// CHF must always appear BEFORE the amount (Swiss French convention: "CHF 1'234.56").
struct DecimalCurrencyFormattingTests {
    // MARK: - asCHF — CHF prefix position

    @Test func asCHF_placesCHFBeforeAmount() {
        let formatted = Decimal(1234.56).asCHF
        #expect(formatted.hasPrefix("CHF"), "Expected CHF before amount, got: \(formatted)")
    }

    @Test func asCHF_doesNotSuffixCHF() {
        let formatted = Decimal(500).asCHF
        #expect(!formatted.hasSuffix("CHF"), "CHF must not appear after amount, got: \(formatted)")
    }

    @Test func asCHF_formatsWithThousandsSeparator() {
        let formatted = Decimal(1234.56).asCHF
        let hasApostrophe = formatted.contains("1'234") || formatted.contains("1\u{2019}234")
        #expect(hasApostrophe, "Expected apostrophe thousands separator, got: \(formatted)")
    }

    @Test func asCHF_includesDecimals() {
        guard let value = Decimal(string: "99.50") else {
            Issue.record("Failed to create Decimal from valid string")
            return
        }
        let formatted = value.asCHF
        #expect(formatted.contains("99.50") || formatted.contains("99,50"), "Expected decimals, got: \(formatted)")
    }

    @Test func asCHF_negativeAmount() {
        let formatted = Decimal(-250).asCHF
        #expect(formatted.contains("-"), "Expected minus sign, got: \(formatted)")
        #expect(formatted.hasPrefix("CHF"), "Expected CHF before amount, got: \(formatted)")
    }

    @Test func asCHF_zero() {
        let formatted = Decimal.zero.asCHF
        #expect(formatted.hasPrefix("CHF"), "Expected CHF before amount, got: \(formatted)")
    }

    // MARK: - asCompactCHF — CHF prefix position

    @Test func asCompactCHF_placesCHFBeforeAmount() {
        let formatted = Decimal(5000).asCompactCHF
        #expect(formatted.hasPrefix("CHF"), "Expected CHF before amount, got: \(formatted)")
    }

    @Test func asCompactCHF_doesNotSuffixCHF() {
        let formatted = Decimal(5000).asCompactCHF
        #expect(!formatted.hasSuffix("CHF"), "CHF must not appear after amount, got: \(formatted)")
    }

    @Test func asCompactCHF_wholeNumberOmitsDecimals() {
        let formatted = Decimal(1500).asCompactCHF
        #expect(!formatted.contains(".00"), "Whole numbers should not show .00, got: \(formatted)")
        #expect(formatted.hasPrefix("CHF"))
    }

    @Test func asCompactCHF_fractionalRoundsToWholeNumber() {
        guard let value = Decimal(string: "1234.56") else {
            Issue.record("Failed to create Decimal from valid string")
            return
        }
        let formatted = value.asCompactCHF
        #expect(formatted.contains("1235") || formatted.contains("1\u{2019}235"),
                "Expected rounded amount, got: \(formatted)")
        #expect(!formatted.contains("."), "Should not contain decimals, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"))
    }

    @Test func asCompactCHF_negativeWholeNumber() {
        let formatted = Decimal(-500).asCompactCHF
        #expect(formatted.contains("-"), "Expected minus sign, got: \(formatted)")
        #expect(formatted.contains("500"), "Expected amount digits, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    @Test func asCompactCHF_negativeFractionalRounds() {
        guard let value = Decimal(string: "-1234.56") else {
            Issue.record("Failed to create Decimal from valid string")
            return
        }
        let formatted = value.asCompactCHF
        #expect(formatted.contains("-"), "Expected minus sign, got: \(formatted)")
        #expect(formatted.contains("1235") || formatted.contains("1\u{2019}235"),
                "Expected rounded amount, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    // MARK: - Optional asCHF

    @Test func optionalAsCHF_nilReturnsFallback() {
        let value: Decimal? = nil
        #expect(value.asCHF() == "-")
    }

    @Test func optionalAsCHF_valueFormatsCHFBefore() {
        let value: Decimal? = 100
        let formatted = value.asCHF()
        #expect(formatted.hasPrefix("CHF"), "Expected CHF before amount, got: \(formatted)")
    }

    // MARK: - asAmount (no currency code)

    @Test func asAmount_doesNotContainCHF() {
        let formatted = Decimal(1234.56).asAmount
        #expect(!formatted.contains("CHF"), "asAmount should not include currency, got: \(formatted)")
    }

    // MARK: - asSignedAmount (no currency code)

    @Test func asSignedAmount_doesNotContainCHF() {
        let formatted = Decimal(500).asSignedAmount(for: .expense)
        #expect(!formatted.contains("CHF"), "asSignedAmount should not include currency, got: \(formatted)")
    }
}
