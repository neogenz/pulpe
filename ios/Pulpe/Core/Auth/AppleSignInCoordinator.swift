import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

@MainActor
final class AppleSignInCoordinator: NSObject {
    nonisolated(unsafe) private var continuation: CheckedContinuation<(idToken: String, nonce: String), Error>?
    private var currentNonce: String?

    func signIn() async throws -> (idToken: String, nonce: String) {
        guard continuation == nil else {
            throw AppleSignInError.inProgress
        }

        let nonce = Self.randomNonceString()
        currentNonce = nonce

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation

                let request = ASAuthorizationAppleIDProvider().createRequest()
                request.requestedScopes = [.fullName, .email]
                request.nonce = Self.sha256(nonce)

                let controller = ASAuthorizationController(authorizationRequests: [request])
                controller.delegate = self
                controller.presentationContextProvider = self
                controller.performRequests()
            }
        } onCancel: {
            // onCancel runs on an arbitrary thread — hop to MainActor to access continuation safely
            Task { @MainActor [weak self] in
                self?.continuation?.resume(throwing: CancellationError())
                self?.continuation = nil
                self?.currentNonce = nil
            }
        }
    }

    // MARK: - Nonce Helpers

    static func randomNonceString(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        precondition(result == errSecSuccess, "Failed to generate random nonce")
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    static func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleSignInCoordinator: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
        }
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AppleSignInCoordinator: ASAuthorizationControllerDelegate {
    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { @MainActor in
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8),
                  let nonce = currentNonce else {
                continuation?.resume(throwing: AppleSignInError.missingToken)
                continuation = nil
                currentNonce = nil
                return
            }

            continuation?.resume(returning: (idToken: idToken, nonce: nonce))
            continuation = nil
            currentNonce = nil
        }
    }

    nonisolated func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { @MainActor in
            if let asError = error as? ASAuthorizationError, asError.code == .canceled {
                continuation?.resume(throwing: AppleSignInError.canceled)
            } else {
                continuation?.resume(throwing: error)
            }
            continuation = nil
            currentNonce = nil
        }
    }
}

// MARK: - Errors

enum AppleSignInError: LocalizedError {
    case missingToken
    case canceled
    case inProgress

    var errorDescription: String? {
        switch self {
        case .missingToken:
            return "Impossible de récupérer les informations Apple — réessaie"
        case .canceled, .inProgress:
            return nil
        }
    }
}
