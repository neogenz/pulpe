import Foundation
import GoogleSignIn
import UIKit

@MainActor
final class GoogleSignInCoordinator {
    func signIn() async throws -> (idToken: String, accessToken: String) {
        guard let clientID = AppConfiguration.googleClientID else {
            throw GoogleSignInError.missingClientID
        }

        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene }).first,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            throw GoogleSignInError.noRootViewController
        }

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)

        guard let idToken = result.user.idToken?.tokenString else {
            throw GoogleSignInError.missingToken
        }

        let accessToken = result.user.accessToken.tokenString
        return (idToken: idToken, accessToken: accessToken)
    }
}

// MARK: - Errors

enum GoogleSignInError: LocalizedError {
    case missingClientID
    case noRootViewController
    case missingToken

    var errorDescription: String? {
        switch self {
        case .missingClientID:
            return "Configuration Google manquante — contacte le support"
        case .noRootViewController:
            return "Impossible d'afficher l'écran de connexion Google"
        case .missingToken:
            return "Impossible de récupérer les informations Google — réessaie"
        }
    }
}
