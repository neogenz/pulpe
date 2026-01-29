import Foundation

enum AuthErrorLocalizer {
    static func localize(_ error: Error) -> String {
        let message = error.localizedDescription.lowercased()

        if message.contains("invalid login credentials") {
            return "Email ou mot de passe incorrect — on réessaie ?"
        }
        if message.contains("too many requests") || message.contains("rate limit") {
            return "Trop de tentatives — patiente quelques minutes"
        }
        if message.contains("email not confirmed") {
            return "Confirme ton email pour pouvoir te connecter"
        }
        if message.contains("network") || message.contains("connection") {
            return "Connexion impossible — vérifie ta connexion internet"
        }
        if message.contains("user not found") {
            return "Aucun compte trouvé avec cet email — crée-en un ?"
        }
        if message.contains("user already registered") || message.contains("already been registered") {
            return "Cet email est déjà utilisé — connecte-toi ou utilise un autre"
        }

        return "Quelque chose n'a pas fonctionné — réessaye"
    }
}
