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

    // MARK: - asAdaptiveCurrency — flexible 0–2 decimals (PUL-329)
    //
    // The withdrawal picker's balance must match the webapp's '1.0-2': no forced
    // decimals on a round value, up to 2 when the value carries a residue.

    @Test func asAdaptiveCurrency_roundBalanceOmitsDecimals() {
        let formatted = Decimal(5500).asAdaptiveCurrency(.chf)
        #expect(
            !formatted.contains(".") && !formatted.contains(","),
            "Expected no decimals on a round balance, got: \(formatted)"
        )
        #expect(containsSwissGroupingSeparator(formatted), "Expected Swiss apostrophe grouping, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    @Test func asAdaptiveCurrency_residueKeepsTwoDecimals() {
        guard let value = Decimal(string: "112.22999999999999") else {
            Issue.record("Failed to create Decimal from valid string")
            return
        }
        let formatted = value.asAdaptiveCurrency(.chf)
        #expect(formatted.contains("112.23") || formatted.contains("112,23"),
                "Expected the residue rounded to 2 decimals, got: \(formatted)")
        #expect(formatted.hasSuffix("CHF"), "Expected CHF after amount, got: \(formatted)")
    }

    // MARK: - asSignedAmount (no currency code)

    @Test func asSignedAmount_doesNotContainCHF() {
        let formatted = Decimal(500).asSignedAmount(for: .expense, in: .chf)
        #expect(!formatted.contains("CHF"), "asSignedAmount should not include currency, got: \(formatted)")
    }
}
