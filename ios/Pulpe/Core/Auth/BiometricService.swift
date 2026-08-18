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
            return AppLocale.string("Biométrie")
        @unknown default:
            return AppLocale.string("Biométrie")
        }
    }

    var biometrySFSymbolName: String {
        switch biometryType {
        case .faceID:
            return "faceid"
        case .touchID:
            return "touchid"
        case .opticID:
            return "opticid"
        case .none:
            return "lock.shield"
        @unknown default:
            return "lock.shield"
        }
    }

    // MARK: - Methods

    func canUseBiometrics() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    func authenticate() async throws {
        // Resolved when the prompt is raised: a stored default would freeze the language
        // of the very first call.
        let reason = AppLocale.string("Activer l'authentification biométrique")
        let context = LAContext()
        try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
    }
}
