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
        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func signedCurrency_negativeCHF_prependsMinusAndKeepsCode() {
        let value: Decimal = -1234.56
        let formatted = value.asSignedCurrency(.chf)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(containsSwissGroupingSeparator(formatted))
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
        #expect(!containsSwissGroupingSeparator(formatted), "EUR amounts must not use Swiss apostrophe separators")
    }

    @Test func signedCurrency_negativeEUR_prependsMinusAndUsesEuroSign() {
        let value: Decimal = -1234.56
        let formatted = value.asSignedCurrency(.eur)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
        #expect(!containsSwissGroupingSeparator(formatted))
    }

    // MARK: - asSignedCurrency(for:) — kind-driven sign

    @Test func signedCurrencyForKind_chf_income_prependsPlusAndKeepsCode() {
        let formatted = Decimal(1234.56).asSignedCurrency(.chf, for: .income)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func signedCurrencyForKind_chf_expense_prependsMinusAndKeepsCode() {
        let formatted = Decimal(1234.56).asSignedCurrency(.chf, for: .expense)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func signedCurrencyForKind_chf_saving_prependsMinus() {
        let formatted = Decimal(1234.56).asSignedCurrency(.chf, for: .saving)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("CHF"))
    }

    @Test func signedCurrencyForKind_eur_income_prependsPlusAndUsesEuroSign() {
        let formatted = Decimal(1234.56).asSignedCurrency(.eur, for: .income)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
        #expect(!containsSwissGroupingSeparator(formatted), "EUR amounts must not use Swiss apostrophe separators")
    }

    @Test func signedCurrencyForKind_eur_expense_prependsMinusAndPreservesFrenchLocale() {
        let formatted = Decimal(1234.56).asSignedCurrency(.eur, for: .expense)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
        #expect(!containsSwissGroupingSeparator(formatted))
    }

    @Test func signedCurrencyForKind_eur_saving_prependsMinusAndUsesEuroSign() {
        let formatted = Decimal(1234.56).asSignedCurrency(.eur, for: .saving)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
    }

    // MARK: - asSignedCompactCurrency (CHF)

    @Test func signedCompactCurrency_positiveCHF_prependsPlusAndRounds() {
        let value: Decimal = 1234.56
        let formatted = value.asSignedCompactCurrency(.chf)

        #expect(formatted.hasPrefix("+"))
        #expect(formatted.hasSuffix("CHF"))
        #expect(!formatted.contains("."))
        #expect(!formatted.contains(","))
        #expect(containsSwissGroupingSeparator(formatted))
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
        #expect(
            !containsSwissGroupingSeparator(formatted),
            "EUR compact amounts must not use Swiss apostrophe separators"
        )
    }

    @Test func signedCompactCurrency_negativeEUR_prependsMinusAndUsesEuroSign() {
        let value: Decimal = -500.8
        let formatted = value.asSignedCompactCurrency(.eur)

        #expect(formatted.hasPrefix("-"))
        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
        #expect(!containsSwissGroupingSeparator(formatted))
    }

    // MARK: - asCompactCurrency

    @Test func compactCurrency_CHF_usesSwissApostrophe() {
        let formatted = Decimal(1234).asCompactCurrency(.chf)

        #expect(formatted.hasSuffix("CHF"))
        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func compactCurrency_EUR_doesNotUseSwissApostrophe() {
        let formatted = Decimal(1234).asCompactCurrency(.eur)

        #expect(!containsSwissGroupingSeparator(formatted))
        #expect(formatted.hasSuffix("€"))
    }

    // MARK: - asCompactAmount(for:) and asAmount(for:)

    @Test func compactAmount_CHF_usesSwissApostrophe() {
        let formatted = Decimal(1234).asCompactAmount(for: .chf)

        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func compactAmount_EUR_doesNotUseSwissApostrophe() {
        let formatted = Decimal(1234).asCompactAmount(for: .eur)

        #expect(!containsSwissGroupingSeparator(formatted))
    }

    @Test func amount_EUR_doesNotUseSwissApostrophe() {
        let formatted = Decimal(1234.56).asAmount(for: .eur)

        #expect(!containsSwissGroupingSeparator(formatted))
    }

    // MARK: - asSignedAmount(for:in:)

    @Test func signedAmount_positiveEUR_doesNotUseSwissApostrophe() {
        let formatted = Decimal(1234.56).asSignedAmount(for: .income, in: .eur)

        #expect(formatted.hasPrefix("+"))
        #expect(!containsSwissGroupingSeparator(formatted))
    }

    @Test func signedAmount_negativeCHF_usesSwissApostrophe() {
        let formatted = Decimal(1234.56).asSignedAmount(for: .expense, in: .chf)

        #expect(formatted.hasPrefix("-"))
        #expect(containsSwissGroupingSeparator(formatted))
    }

    // MARK: - asSignedCompactAmount(for:)

    @Test func signedCompactAmount_EUR_doesNotUseSwissApostrophe() {
        let formatted = Decimal(1234).asSignedCompactAmount(for: .eur)

        #expect(formatted.hasPrefix("+"))
        #expect(!containsSwissGroupingSeparator(formatted))
    }
}
