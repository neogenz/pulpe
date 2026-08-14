import Foundation
@testable import Pulpe
import Testing

@Suite("AppLocale")
struct AppLocaleTests {
    @Test func uiLocale_keepsTheRegionWhenTheLanguageChanges() {
        let switched = AppLocale.uiLocale(for: .de, basedOn: Locale(identifier: "fr_CH"))

        #expect(switched.language.languageCode?.identifier == "de")
        #expect(switched.region?.identifier == "CH")
    }

    /// The reason `uiLocale` composes onto the current locale instead of building an
    /// identifier: a user who set a regional preference in iOS Settings keeps Swiss
    /// conventions after switching the app to German.
    @Test func uiLocale_keepsARegionalPreferenceOverride() {
        let switched = AppLocale.uiLocale(for: .de, basedOn: Locale(identifier: "en_US@rg=chzzzz"))

        #expect(switched.language.languageCode?.identifier == "de")
        #expect(switched.currency?.identifier == "CHF")
    }

    @Test(arguments: SupportedLocale.allCases)
    func uiLocale_carriesTheRequestedLanguage(_ language: SupportedLocale) {
        let resolved = AppLocale.uiLocale(for: language, basedOn: Locale(identifier: "fr_CH"))

        #expect(resolved.language.languageCode?.identifier == language.rawValue)
    }

    /// A server that learns a fifth language must not break a shipped binary.
    @Test func unknownLanguageCode_isNotASupportedLocale() {
        #expect(SupportedLocale(rawValue: "es") == nil)
        #expect(SupportedLocale.fallback == .fr)
    }

    /// Mirror of the webapp's `resolveStartupLanguage`: before any account exists, the
    /// first screen renders in the device language when the catalog ships it.
    @Test func detected_matchesTheFirstShippedDeviceLanguage() {
        #expect(AppLocale.detected(from: ["de-CH", "en-US"]) == .de)
        #expect(AppLocale.detected(from: ["it"]) == .it)
    }

    /// A Spanish-first device with German second lands on German — the ordered list is
    /// scanned the way bundle matching scans it, not truncated to the first entry.
    @Test func detected_skipsUnshippedLanguagesInsteadOfGivingUp() {
        #expect(AppLocale.detected(from: ["es-ES", "de-DE"]) == .de)
    }

    @Test func detected_fallsBackToFrenchWhenNoDeviceLanguageIsShipped() {
        #expect(AppLocale.detected(from: ["es-ES", "pt-BR"]) == .fr)
        #expect(AppLocale.detected(from: []) == .fr)
    }

    @Test func nativeNames_areWrittenInTheirOwnLanguage() {
        #expect(SupportedLocale.de.nativeName == "Deutsch")
        #expect(SupportedLocale.it.nativeName == "Italiano")
    }

    /// `String(localized:)` alone stays on the bundle language whatever locale it is
    /// handed; the resource-scoped lookup is what actually switches. If this fails, every
    /// out-of-tree string — notifications, widget entries, navigation titles — is French.
    @Test func string_resolvesAgainstTheRequestedLanguage() {
        let german = AppLocale.string("Préférences", locale: Locale(identifier: "de"))

        #expect(german == "Einstellungen")
    }

    @Test func string_fallsBackToFrenchForAnUntranslatedKey() {
        let key: String.LocalizationValue = "Pulpe"

        #expect(AppLocale.string(key, locale: Locale(identifier: "de")) == "Pulpe")
    }
}
