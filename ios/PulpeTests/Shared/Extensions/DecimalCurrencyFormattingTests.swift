import Foundation
@testable import Pulpe
import Testing

/// Regression tests for CHF currency formatting.
/// CHF must always appear AFTER the amount (Swiss French convention: "1'234.56 CHF").
struct DecimalCurrencyFormattingTests {
    // MARK: - asCHF — CHF suffix position

    @Test func asCHF_placesCHFAfterAmount() {
        let formatted = Decimal(1234.56).asCHF
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    @Test func asCHF_doesNotPrefixCHF() {
        let formatted = Decimal(500).asCHF
        #expect(!formatted.hasPrefix("CHF"), "CHF must not appear before amount, got: \(formatted)")
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
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    @Test func asCHF_zero() {
        let formatted = Decimal.zero.asCHF
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    // MARK: - asCompactCHF — CHF suffix position

    @Test func asCompactCHF_placesCHFAfterAmount() {
        let formatted = Decimal(5000).asCompactCHF
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    @Test func asCompactCHF_doesNotPrefixCHF() {
        let formatted = Decimal(5000).asCompactCHF
        #expect(!formatted.hasPrefix("CHF"), "CHF must not appear before amount, got: \(formatted)")
    }

    @Test func asCompactCHF_wholeNumberOmitsDecimals() {
        let formatted = Decimal(1500).asCompactCHF
        #expect(!formatted.contains(".00"), "Whole numbers should not show .00, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"))
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

    @Test func optionalAsCHF_valueFormatsCHFAfter() {
        let value: Decimal? = 100
        let formatted = value.asCHF()
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    // MARK: - asAmount(for:) — no currency code

    @Test func asAmount_doesNotContainCHF() {
        let formatted = Decimal(1234.56).asAmount(for: .chf)
        #expect(!formatted.contains("CHF"), "asAmount should not include currency, got: \(formatted)")
    }

    // MARK: - asSignedAmount (no currency code)

    @Test func asSignedAmount_doesNotContainCHF() {
        let formatted = Decimal(500).asSignedAmount(for: .expense, in: .chf)
        #expect(!formatted.contains("CHF"), "asSignedAmount should not include currency, got: \(formatted)")
    }
}
