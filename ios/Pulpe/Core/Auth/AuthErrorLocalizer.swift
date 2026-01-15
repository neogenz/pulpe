import Foundation

enum AuthErrorLocalizer {
    static func localize(_ error: Error) -> String {
        let message = error.localizedDescription.lowercased()

        if message.contains("invalid login credentials") {
            return "Email ou mot de passe incorrect"
        }
        if message.contains("too many requests") || message.contains("rate limit") {
            return "Trop de tentatives — patiente quelques minutes"
        }
        if message.contains("email not confirmed") {
            return "Confirme ton email pour pouvoir te connecter"
        }
        if message.contains("network") || message.contains("connection") {
            return "Erreur de connexion — vérifie ta connexion internet"
        }
        if message.contains("user not found") {
            return "Aucun compte trouvé avec cet email"
        }

        return "Erreur de connexion — réessaie"
    }
}
