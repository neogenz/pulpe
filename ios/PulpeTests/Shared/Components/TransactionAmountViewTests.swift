import Foundation
@testable import Pulpe
import Testing

@Suite("TransactionAmountView.secondaryText")
struct TransactionAmountViewTests {
    // Swiss grouping separator (U+2019-style apostrophe used by de_CH / fr_CH locales).

    // MARK: - Helpers

    private static func makeTransaction(
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) -> Transaction {
        Transaction(
            id: "tx",
            budgetId: "b1",
            budgetLineId: nil,
            name: "Test",
            amount: 100,
            kind: .expense,
            transactionDate: Date(),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date(),
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            targetCurrency: targetCurrency,
            exchangeRate: exchangeRate
        )
    }

    // MARK: - Secondary text policy

    @Test func row_withoutConversionMetadata_returnsNil() {
        let transaction = Self.makeTransaction()

        let secondary = TransactionAmountView.secondaryText(for: transaction, in: .chf)

        #expect(secondary == nil)
    }

    @Test func row_sameCurrency_returnsNil() {
        let transaction = Self.makeTransaction(
            originalAmount: 100,
            originalCurrency: .chf,
            targetCurrency: .chf,
            exchangeRate: 1
        )

        let secondary = TransactionAmountView.secondaryText(for: transaction, in: .chf)

        #expect(secondary == nil)
    }

    @Test func row_differentCurrency_showsOriginalFormattedInSecondary() throws {
        let transaction = Self.makeTransaction(
            originalAmount: 1234.56,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: 0.9412
        )

        let formatted = try #require(
            TransactionAmountView.secondaryText(for: transaction, in: .chf)
        )

        #expect(formatted.hasSuffix("€"))
        #expect(!formatted.contains("EUR"))
    }

    @Test func row_secondary_EUR_doesNotUseSwissApostrophe() throws {
        let transaction = Self.makeTransaction(
            originalAmount: 1234.56,
            originalCurrency: .eur,
            targetCurrency: .chf,
            exchangeRate: 0.9412
        )

        let formatted = try #require(
            TransactionAmountView.secondaryText(for: transaction, in: .chf)
        )

        #expect(
            !containsSwissGroupingSeparator(formatted),
            "EUR secondary amount must not use Swiss apostrophe separators"
        )
    }

    // MARK: - Reverse direction (EUR display)

    @Test func row_differentCurrency_CHFOriginalInEURDisplay_usesSwissApostrophe() throws {
        // Transaction captured in CHF but displayed in an EUR-native context.
        let transaction = Self.makeTransaction(
            originalAmount: 1234.56,
            originalCurrency: .chf,
            targetCurrency: .eur,
            exchangeRate: 1.0624
        )

        let formatted = try #require(
            TransactionAmountView.secondaryText(for: transaction, in: .eur)
        )

        #expect(formatted.hasSuffix("CHF"))
        #expect(containsSwissGroupingSeparator(formatted))
    }
}
