import Foundation
@testable import Pulpe
import Testing

/// Lot A moved every error message into the String Catalog. These assert the three
/// behaviours that fail silently: a translated key resolves, server-authored text is
/// left alone, and a plural picks its language's own rule.
@Suite("Localized error messages")
struct APIErrorLocalizationTests {
    private let german = AppLocale.uiLocale(for: .de)
    private let italian = AppLocale.uiLocale(for: .it)

    @Test func message_knownCase_resolvesInTheRequestedLanguage() {
        #expect(APIError.unauthorized.message(in: german) == "Sitzung abgelaufen — melde dich neu an, um fortzufahren")
        #expect(APIError.notFound.message(in: italian) == "Risorsa non trovata — riprova o aggiorna l'app")
    }

    /// The backend answers in the account language and we have no key for a sentence we
    /// did not write, so these two cases must not go through the catalog at all.
    @Test func message_serverAuthoredText_passesThroughUntouched() {
        let fromServer = "Le serveur a répondu ceci"

        #expect(APIError.serverError(message: fromServer).message(in: german) == fromServer)
        #expect(APIError.conflict(message: fromServer).message(in: german) == fromServer)
    }

    @Test func message_interpolatedCase_keepsItsArgument() {
        #expect(APIError.unknown(statusCode: 503).message(in: german) == "Etwas hat nicht geklappt (Code: 503)")
    }

    @Test func authErrorLocalizer_resolvesInTheRequestedLanguage() {
        let message = AuthErrorLocalizer.localize(
            APIError.networkError(URLError(.notConnectedToInternet)),
            in: german
        )

        #expect(message == "Verbindung nicht möglich — prüf deine Internetverbindung")
    }

    /// The tag summary used to pick its form with a `count == 1` ternary, which is the
    /// French rule applied to every language. German separates Tag from Tags on the same
    /// boundary, so a wrong rule set here would still read right — hence both forms.
    @Test func tagCount_usesThePluralRuleOfEachLanguage() {
        #expect(AppLocale.string("\(1) tags", locale: german) == "1 Tag")
        #expect(AppLocale.string("\(4) tags", locale: german) == "4 Tags")
        #expect(AppLocale.string("\(1) tags", locale: AppLocale.uiLocale(for: .fr)) == "1 tag")
        #expect(AppLocale.string("\(4) tags", locale: AppLocale.uiLocale(for: .fr)) == "4 tags")
    }

    /// Keys the later lots have not reached yet must render the French source, never a raw
    /// key. The second literal is deliberately absent from the catalog — the catalog is
    /// only synced from the app target, so this file cannot add it.
    @Test func keyWithoutAGermanTranslation_fallsBackToFrench() {
        #expect(AppLocale.string("Aucun objectif", locale: german) == "Kein Sparziel")
        #expect(
            AppLocale.string("Une phrase absente du catalogue", locale: german)
                == "Une phrase absente du catalogue"
        )
    }
}
