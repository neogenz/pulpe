import Foundation

/// Localizes domain errors with the Pulpe pattern: "[What happened] — [suggestion]"
/// Use this for all user-facing error messages outside of authentication flows.
enum DomainErrorLocalizer {
    /// Localize any error to a user-friendly message, in an explicit language.
    /// Always follows the pattern: "[What happened] — [suggestion]"
    static func localize(_ error: Error, in locale: Locale = AppLocale.currentUILocale) -> String {
        // APIError owns known-code localization, including deletion conflicts
        // and committed savings-goal deletions that only failed recalculation.
        if let apiError = error as? APIError {
            return apiError.message(in: locale)
        }

        return AppLocale.string(catalogKey(for: error), locale: locale)
    }

    private static func catalogKey(for error: Error) -> String.LocalizationValue {
        // URLError type matching
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost:
                return "Connexion impossible — vérifie ta connexion internet"
            case .cannotFindHost, .badURL:
                return "Cette ressource n'existe plus — rafraîchis la page"
            default:
                break
            }
        }

        // DecodingError type matching
        if error is DecodingError {
            return "Les données reçues sont illisibles — réessaie"
        }

        // Generic fallback - still follows the pattern
        return "Quelque chose n'a pas fonctionné — réessaie"
    }
}
