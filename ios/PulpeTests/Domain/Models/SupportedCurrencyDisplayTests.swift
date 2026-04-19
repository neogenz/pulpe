import Foundation
@testable import Pulpe
import Testing

@Suite("SupportedCurrency Display")
struct SupportedCurrencyDisplayTests {
    @Test func flag_chf_returnsSwissFlag() {
        #expect(SupportedCurrency.chf.flag == "🇨🇭")
    }

    @Test func flag_eur_returnsEuFlag() {
        #expect(SupportedCurrency.eur.flag == "🇪🇺")
    }

    @Test func nativeName_chf_returnsFrancSuisse() {
        #expect(SupportedCurrency.chf.nativeName == "Franc suisse")
    }

    @Test func nativeName_eur_returnsEuro() {
        #expect(SupportedCurrency.eur.nativeName == "Euro")
    }

    @Test func compactLabel_chf_combinesFlagAndCode() {
        #expect(SupportedCurrency.chf.compactLabel == "🇨🇭 CHF")
    }

    @Test func compactLabel_eur_combinesFlagAndCode() {
        #expect(SupportedCurrency.eur.compactLabel == "🇪🇺 EUR")
    }

    @Test func fullLabel_chf_includesFlagCodeAndName() {
        #expect(SupportedCurrency.chf.fullLabel == "🇨🇭 CHF · Franc suisse")
    }

    @Test func fullLabel_eur_includesFlagCodeAndName() {
        #expect(SupportedCurrency.eur.fullLabel == "🇪🇺 EUR · Euro")
    }

    @Test func symbol_chf_keepsThreeLetterCode() {
        #expect(SupportedCurrency.chf.symbol == "CHF")
    }

    @Test func symbol_eur_usesEuroSign() {
        #expect(SupportedCurrency.eur.symbol == "€")
    }
}
