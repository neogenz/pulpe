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
        
        // Check for common error patterns
        let description = error.localizedDescription.lowercased()
        
        // Network errors
        if description.contains("network") || 
           description.contains("connection") || 
           description.contains("timeout") ||
           description.contains("offline") ||
           description.contains("internet") {
            return "Connexion impossible — vérifie ta connexion internet"
        }
        
        // Server errors
        if description.contains("server") || description.contains("500") {
            return "Le serveur a rencontré un problème — réessaie dans quelques instants"
        }
        
        // Decoding errors
        if description.contains("decode") || description.contains("parsing") {
            return "Les données reçues sont illisibles — réessaie"
        }
        
        // Rate limiting
        if description.contains("rate") || description.contains("too many") {
            return "Trop de tentatives — patiente quelques minutes"
        }
        
        // Not found
        if description.contains("not found") || description.contains("404") {
            return "Cette ressource n'existe plus — rafraîchis la page"
        }
        
        // Unauthorized
        if description.contains("unauthorized") || description.contains("401") {
            return "Session expirée — reconnecte-toi pour continuer"
        }
        
        // Forbidden
        if description.contains("forbidden") || description.contains("403") {
            return "Tu n'as pas accès à cette ressource"
        }
        
        // Conflict
        if description.contains("conflict") || description.contains("409") {
            return "Cette action entre en conflit avec une autre — réessaie"
        }
        
        // Validation errors
        if description.contains("validation") || description.contains("invalid") {
            return "Les informations fournies ne sont pas valides — vérifie et réessaie"
        }
        
        // Generic fallback - still follows the pattern
        return "Quelque chose n'a pas fonctionné — réessaie"
    }
}
