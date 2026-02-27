import Foundation

/// Shared PIN validation logic — eliminates duplication across Pin ViewModels.
/// Preserves existing PinCryptoProtocols for dependency injection.
enum PinValidation {
    /// Result of PIN derivation, exposes salt metadata needed by PinSetup.
    struct DeriveResult {
        let clientKeyHex: String
        let saltResponse: EncryptionSaltResponse
    }

    /// Derives a client key from PIN, validates it against the server, and stores it.
    /// Used by PinEntryViewModel and PinSetupViewModel.
    static func deriveValidateAndStore(
        pin: String,
        cryptoService: any PinCryptoKeyDerivation,
        encryptionAPI: any PinEncryptionValidation,
        clientKeyManager: any PinClientKeyStorage
    ) async throws -> DeriveResult {
        let salt = try await encryptionAPI.getSalt()
        let clientKeyHex = try await cryptoService.deriveClientKey(
            pin: pin, saltHex: salt.salt, iterations: salt.kdfIterations
        )
        try await encryptionAPI.validateKey(clientKeyHex)
        await clientKeyManager.store(clientKeyHex, enableBiometric: false)
        return DeriveResult(clientKeyHex: clientKeyHex, saltResponse: salt)
    }

    /// Derives a client key from PIN without validation (for recovery flow).
    /// Used by PinRecoveryViewModel which calls recover() instead of validateKey().
    static func derive(
        pin: String,
        cryptoService: any PinCryptoKeyDerivation,
        encryptionAPI: any PinEncryptionValidation
    ) async throws -> DeriveResult {
        let salt = try await encryptionAPI.getSalt()
        let clientKeyHex = try await cryptoService.deriveClientKey(
            pin: pin, saltHex: salt.salt, iterations: salt.kdfIterations
        )
        return DeriveResult(clientKeyHex: clientKeyHex, saltResponse: salt)
    }
}
