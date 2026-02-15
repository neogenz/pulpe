import Foundation
import OSLog

actor ClientKeyManager {
    static let shared = ClientKeyManager()

    private var cachedClientKeyHex: String?
    private let keychainManager: KeychainManager
    private let biometricService: BiometricService

    init(keychainManager: KeychainManager = .shared, biometricService: BiometricService = .shared) {
        self.keychainManager = keychainManager
        self.biometricService = biometricService
    }

    // MARK: - Query

    /// Returns cached key or tries regular keychain (no FaceID)
    func resolveClientKey() async -> String? {
        if let cached = cachedClientKeyHex { return cached }

        if let stored = await keychainManager.getClientKey() {
            cachedClientKeyHex = stored
            return stored
        }

        return nil
    }

    /// Returns true if clientKey is available (cache or keychain)
    var hasClientKey: Bool {
        cachedClientKeyHex != nil
    }

    /// Returns true if biometric clientKey exists in keychain
    func hasBiometricKey() async -> Bool {
        await keychainManager.hasBiometricClientKey()
    }

    // MARK: - FaceID Resolution

    /// Attempt FaceID retrieval, cache result
    func resolveViaBiometric() async throws -> String? {
        let hex = try await keychainManager.getBiometricClientKey()

        if let hex {
            cachedClientKeyHex = hex
            try? await keychainManager.saveClientKey(hex)
        }

        return hex
    }

    // MARK: - Storage After PIN Entry

    /// Store clientKey after successful PIN validation
    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        cachedClientKeyHex = clientKeyHex
        try? await keychainManager.saveClientKey(clientKeyHex)

        if enableBiometric {
            await keychainManager.saveBiometricClientKey(clientKeyHex)
        }
    }

    /// Enable biometric for current cached key
    func enableBiometric() async -> Bool {
        guard let hex = cachedClientKeyHex else { return false }
        return await keychainManager.saveBiometricClientKey(hex)
    }

    /// Disable biometric storage
    func disableBiometric() async {
        await keychainManager.clearBiometricClientKey()
    }

    // MARK: - Clearing

    /// Clear in-memory cache (for background timeout)
    func clearCache() {
        cachedClientKeyHex = nil
    }

    /// Clear session (regular keychain + cache, keep biometric for next unlock)
    func clearSession() async {
        cachedClientKeyHex = nil
        await keychainManager.clearClientKey()
    }

    /// Full clear (logout - everything)
    func clearAll() async {
        cachedClientKeyHex = nil
        await keychainManager.clearClientKey()
        await keychainManager.clearBiometricClientKey()
    }
}
