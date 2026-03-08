import Foundation

// MARK: - PIN Crypto Protocols
//
// Shared protocols for PIN-based cryptographic operations across the auth flow.
// These protocols enable dependency injection for testability while maintaining
// a single source of truth for crypto service contracts.

/// Derives a client encryption key from a user's PIN using PBKDF2.
protocol PinCryptoKeyDerivation: Sendable {
    /// Derives a hex-encoded client key from the given PIN and salt.
    /// - Parameters:
    ///   - pin: The user's PIN (4-6 digits)
    ///   - saltHex: Hex-encoded salt from the server
    ///   - iterations: PBKDF2 iteration count
    /// - Returns: Hex-encoded derived key
    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String
}

/// Validates encryption keys against the server and manages recovery keys.
protocol PinEncryptionValidation: Sendable {
    /// Fetches the user's encryption salt and KDF parameters.
    func getSalt() async throws -> EncryptionSaltResponse

    /// Validates a client key against the server's key check.
    /// - Throws: `APIError.clientKeyInvalid` if the key doesn't match
    func validateKey(_ clientKeyHex: String) async throws
}

/// Extended encryption operations for PIN setup and recovery flows.
protocol PinEncryptionSetup: PinEncryptionValidation {
    /// Creates a new recovery key for the user.
    /// - Returns: The formatted recovery key to display to the user
    func setupRecoveryKey() async throws -> String
}

/// Extended encryption operations for PIN recovery flow.
protocol PinEncryptionRecovery: PinEncryptionValidation {
    /// Recovers access using a recovery key and sets a new client key.
    /// - Parameters:
    ///   - recoveryKey: The user's recovery key (stripped of formatting)
    ///   - newClientKeyHex: The new derived client key to set
    func recover(recoveryKey: String, newClientKeyHex: String) async throws

    /// Generates a new recovery key after successful recovery.
    /// - Returns: The new formatted recovery key
    func regenerateRecoveryKey() async throws -> String
}

/// Extended encryption operations for PIN change flow.
protocol PinEncryptionChangePin: PinEncryptionValidation {
    /// Changes the PIN by re-encrypting all data with a new client key.
    /// Returns the new recovery key and key check.
    func changePin(oldClientKeyHex: String, newClientKeyHex: String) async throws -> ChangePinResponse
}

/// Securely stores the client encryption key.
protocol PinClientKeyStorage: Sendable {
    /// Stores the client key in memory and optionally in biometric-protected keychain.
    /// - Parameters:
    ///   - clientKeyHex: The hex-encoded client key
    ///   - enableBiometric: Whether to also store in biometric keychain
    func store(_ clientKeyHex: String, enableBiometric: Bool) async
}

// MARK: - Default Conformances

extension CryptoService: PinCryptoKeyDerivation {}
extension ClientKeyManager: PinClientKeyStorage {}

extension EncryptionAPI: PinEncryptionValidation {}
extension EncryptionAPI: PinEncryptionSetup {}
extension EncryptionAPI: PinEncryptionRecovery {}
extension EncryptionAPI: PinEncryptionChangePin {}

// MARK: - PIN Error Messages

extension APIError {
    /// User-facing message for PIN validation errors (entry, change).
    var pinValidationMessage: String {
        switch self {
        case .rateLimited: "Trop de tentatives, patiente un moment"
        case .networkError: "Erreur de connexion, réessaie"
        default: "Ce code ne semble pas correct"
        }
    }
}

extension CryptoServiceError {
    /// User-facing message for crypto errors during PIN flows.
    var pinUserMessage: String {
        switch self {
        case .invalidSalt, .invalidIterations: "Erreur de sécurité, contacte le support"
        case .derivationFailed: "Erreur de chiffrement, réessaie"
        case .invalidPin: "Code invalide"
        }
    }
}
