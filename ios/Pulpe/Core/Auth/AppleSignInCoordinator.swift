import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

@MainActor
final class AppleSignInCoordinator: NSObject {
    // SAFETY: All reads/writes happen on MainActor — delegate callbacks hop via Task { @MainActor in }.
    // Marked nonisolated(unsafe) because the delegate methods are nonisolated and capture self.
    nonisolated(unsafe) private var continuation: CheckedContinuation<(idToken: String, nonce: String), Error>?
    private var currentNonce: String?
    private var cachedWindow: UIWindow?

    func signIn() async throws -> (idToken: String, nonce: String) {
        guard continuation == nil else {
            throw AppleSignInError.inProgress
        }

        let nonce = Self.randomNonceString()
        currentNonce = nonce

        // Cache window on MainActor so presentationAnchor can use it safely
        cachedWindow = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation

            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(nonce)

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    // MARK: - Nonce Helpers

    static func randomNonceString(length: Int = 32) -> String {
        var bytes = [UInt8](repeating: 0, count: length)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        precondition(result == errSecSuccess, "Failed to generate random nonce")
        // 64-char charset (power of 2) — eliminates modulo bias since 256 % 64 == 0
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_")
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    static func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func cleanup() {
        continuation = nil
        currentNonce = nil
        cachedWindow = nil
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleSignInCoordinator: ASAuthorizationControllerPresentationContextProviding {
    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // Use DispatchQueue.main.sync to safely access the cached window from any thread.
        // presentationAnchor(for:) is called synchronously by ASAuthorizationController,
        // and while it's typically on the main thread, the API contract doesn't guarantee it.
        DispatchQueue.main.sync {
            cachedWindow ?? ASPresentationAnchor()
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
                cleanup()
                return
            }

            continuation?.resume(returning: (idToken: idToken, nonce: nonce))
            cleanup()
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
            cleanup()
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
