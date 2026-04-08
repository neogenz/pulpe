import Foundation
import GoogleSignIn
import UIKit

struct GoogleSignInResult: Sendable {
    let idToken: String
    let accessToken: String
    let givenName: String?
}

@MainActor
final class GoogleSignInCoordinator {
    private var isInProgress = false

    func signIn() async throws -> GoogleSignInResult {
        guard !isInProgress else {
            throw GoogleSignInError.inProgress
        }

        isInProgress = true
        defer { isInProgress = false }

        guard let clientID = AppConfiguration.googleClientID else {
            throw GoogleSignInError.missingClientID
        }

        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let rootViewController = windowScene.keyWindow?.rootViewController else {
            throw GoogleSignInError.noRootViewController
        }

        let result: GIDSignInResult
        do {
            result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)
        } catch let error as GIDSignInError where error.code == .canceled {
            throw GoogleSignInError.canceled
        }

        guard let idToken = result.user.idToken?.tokenString else {
            throw GoogleSignInError.missingToken
        }

        let accessToken = result.user.accessToken.tokenString
        let givenName = result.user.profile?.givenName
        return GoogleSignInResult(
            idToken: idToken, accessToken: accessToken, givenName: givenName
        )
    }
}

// MARK: - Errors

enum GoogleSignInError: LocalizedError {
    case missingClientID
    case noRootViewController
    case missingToken
    case canceled
    case inProgress

    var errorDescription: String? {
        switch self {
        case .missingClientID:
            return "Configuration Google manquante — contacte le support"
        case .noRootViewController:
            return "Impossible d'afficher l'écran de connexion Google"
        case .missingToken:
            return "Impossible de récupérer les informations Google — réessaie"
        case .canceled, .inProgress:
            return nil
        }
    }
}
