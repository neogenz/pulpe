import Foundation
@testable import Pulpe
import Testing

/// PUL-100: the amount-input prefill formatter follows the field's currency
/// (CHF → fr_CH with the canonical apostrophe, EUR → fr_FR) instead of the
/// device locale. The round-trip through `parsedAsAmount` must stay lossless,
/// otherwise prefilled amounts would mutate on save.
struct FormattersAmountInputTests {
    @Test func chf_usesSwissApostropheGrouping() {
        let formatted = Formatters.amountInput(for: .chf)
            .string(from: NSDecimalNumber(string: "1234.56")) ?? ""
        #expect(containsSwissGroupingSeparator(formatted))
    }

    @Test func eur_usesFrenchSeparators() {
        let formatted = Formatters.amountInput(for: .eur)
            .string(from: NSDecimalNumber(string: "1234.56")) ?? ""
        #expect(!containsSwissGroupingSeparator(formatted))
        #expect(formatted.contains(","))
    }

    @Test func wholeAmount_rendersWithoutForcedDecimals() {
        let formatted = Formatters.amountInput(for: .chf)
            .string(from: NSDecimalNumber(value: 50)) ?? ""
        #expect(formatted == "50")
    }

    @Test(arguments: [SupportedCurrency.chf, SupportedCurrency.eur])
    func prefill_roundTripsThroughParsedAsAmount(currency: SupportedCurrency) throws {
        let amount = try #require(Decimal(string: "1234.56"))
        let prefill = Formatters.amountInput(for: currency)
            .string(from: amount as NSDecimalNumber) ?? ""
        #expect(prefill.parsedAsAmount == amount)
    }
}
