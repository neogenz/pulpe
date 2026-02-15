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

    func authenticate(reason: String = "Activer l'authentification biométrique") async throws {
        let context = LAContext()
        try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
    }
}
