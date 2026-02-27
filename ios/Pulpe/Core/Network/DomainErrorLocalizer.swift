import Foundation

/// Localizes domain errors with the Pulpe pattern: "[What happened] — [suggestion]"
/// Use this for all user-facing error messages outside of authentication flows.
enum DomainErrorLocalizer {
    /// Localize any error to a user-friendly French message
    /// Always follows the pattern: "[What happened] — [suggestion]"
    static func localize(_ error: Error) -> String {
        // APIError already has proper localization
        if let apiError = error as? APIError {
            return apiError.localizedDescription
        }

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
