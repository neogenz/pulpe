import Foundation
import LocalAuthentication

final class BiometricService: Sendable {
    static let shared = BiometricService()

    private init() {}

    // MARK: - Properties

    var biometryType: LABiometryType {
        let context = LAContext()
        var error: NSError?
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return context.biometryType
    }

    var biometryDisplayName: String {
        switch biometryType {
        case .faceID:
            return "Face ID"
        case .touchID:
            return "Touch ID"
        case .opticID:
            return "Optic ID"
        case .none:
            return "Biométrie"
        @unknown default:
            return "Biométrie"
        }
    }

    // MARK: - Methods

    func canUseBiometrics() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    func authenticate() async throws -> Bool {
        let context = LAContext()

        guard canUseBiometrics() else {
            throw BiometricError.unavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Authentifiez-vous pour accéder à Pulpe"
            ) { success, error in
                if success {
                    continuation.resume(returning: true)
                } else if let error = error as? LAError {
                    continuation.resume(throwing: BiometricService.mapError(error))
                } else {
                    continuation.resume(throwing: BiometricError.failed)
                }
            }
        }
    }

    // MARK: - Private

    private static func mapError(_ error: LAError) -> BiometricError {
        switch error.code {
        case .biometryNotAvailable:
            return .unavailable
        case .biometryNotEnrolled:
            return .notEnrolled
        case .userCancel, .userFallback, .systemCancel:
            return .cancelled
        case .biometryLockout:
            return .lockout
        default:
            return .failed
        }
    }
}

// MARK: - Errors

enum BiometricError: LocalizedError {
    case unavailable
    case notEnrolled
    case cancelled
    case lockout
    case failed

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "L'authentification biométrique n'est pas disponible sur cet appareil."
        case .notEnrolled:
            return "Aucune biométrie n'est configurée sur cet appareil."
        case .cancelled:
            return "L'authentification a été annulée."
        case .lockout:
            return "Trop de tentatives échouées. Réessayez plus tard."
        case .failed:
            return "L'authentification a échoué."
        }
    }
}
