import Foundation
import OSLog

/// Manages the client encryption key lifecycle with caching and biometric storage.
/// Thread-safe actor that handles key derivation, storage, and retrieval for end-to-end encryption.
///
/// ## Security Note: Client Key as Swift `String` (Accepted Risk)
///
/// The client key is held as a hex-encoded `String`. Swift `String` is a value type
/// backed by a heap-allocated buffer managed through ARC/copy-on-write. Setting the
/// property to `nil` removes the reference but does **not** guarantee zeroing of the
/// underlying bytes before the allocator reclaims the page. Copies may also exist
/// transiently in registers, on the stack, or inside intermediate `String` values.
///
/// **Why this is accepted (LOW practical risk in the standard iOS threat model):**
///
/// 1. **iOS app sandbox** -- In the standard model (non-jailbroken/non-rooted device),
///    process isolation blocks inter-app heap reads.
/// 2. **Split-key architecture** -- The client key alone is insufficient to decrypt
///    data. Decryption requires `DEK = HKDF(clientKey + masterKey, salt)` where
///    `masterKey` remains server-side.
/// 3. **Short residency** -- The cache is cleared on background timeout
///    (`AppConfiguration.backgroundGracePeriod`, currently 30 s), logout, and app
///    termination.
/// 4. **Threat-model boundary** -- On compromised devices (jailbreak/root/instrumentation),
///    residual-memory extraction assumptions can break. This accepted risk does not
///    cover that scenario.
/// 5. **Proportionality** -- A custom unsafe memory wrapper would increase complexity
///    and unsafe surface without preventing compiler/runtime copies in all contexts.
///
/// **Mitigations in place:**
/// - `clearCache()` / `clearSession()` / `clearAll()` nil out references promptly.
/// - `CryptoService.deriveClientKey` zeros the raw `[UInt8]` derivation buffer before
///   returning the hex string.
/// - Keychain entries use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
/// - `X-Client-Key` is sent over HTTPS/TLS in production; local development can use
///   `http://localhost`.
///
/// **Review date:** 2026-02-24 | **Reviewer:** Code review finding C1-1
actor ClientKeyManager {
    static let shared = ClientKeyManager()

    private var cachedClientKeyHex: String?
    private let keychainManager: KeychainManager
    private let biometricService: BiometricService

    /// Coalescing task to prevent concurrent keychain reads
    private var resolveTask: Task<String?, Never>?

    init(keychainManager: KeychainManager = .shared, biometricService: BiometricService = .shared) {
        self.keychainManager = keychainManager
        self.biometricService = biometricService
    }

    // MARK: - Query

    /// Returns cached key or tries regular keychain (no FaceID)
    /// Uses task coalescing to prevent concurrent keychain reads
    func resolveClientKey() async -> String? {
        // Fast path: return cached value immediately
        if let cached = cachedClientKeyHex { return cached }

        // If a resolve is already in progress, await it
        if let existingTask = resolveTask {
            return await existingTask.value
        }

        // Start a new resolve task
        let task = Task<String?, Never> {
            // Double-check cache after acquiring the task slot
            if let cached = cachedClientKeyHex { return cached }

            if let stored = await keychainManager.getClientKey() {
                cachedClientKeyHex = stored
                return stored
            }
            return nil
        }

        resolveTask = task
        let result = await task.value
        resolveTask = nil

        return result
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
            do {
                try await keychainManager.saveClientKey(hex)
            } catch {
                Logger.encryption.warning("Failed to cache client key in keychain: \(error.localizedDescription)")
            }
        }

        return hex
    }

    // MARK: - Storage After PIN Entry

    /// Store clientKey after successful PIN validation
    func store(_ clientKeyHex: String, enableBiometric: Bool) async {
        cachedClientKeyHex = clientKeyHex
        do {
            try await keychainManager.saveClientKey(clientKeyHex)
        } catch {
            Logger.encryption.warning("Failed to save client key to keychain: \(error.localizedDescription)")
        }

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

    /// Clear in-memory cache (for background timeout).
    /// Note: Swift Strings are value types on the heap; nil-ing removes the reference
    /// but does not guarantee zeroing of the underlying bytes before deallocation.
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
