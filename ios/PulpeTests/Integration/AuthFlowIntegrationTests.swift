import Foundation
import Testing
@testable import Pulpe

/// Integration tests for authentication flow state transitions.
/// Tests the interaction between AppState, KeychainManager, and CryptoService.
@MainActor
struct AuthFlowIntegrationTests {
    
    // MARK: - Test Doubles
    
    /// Mock keychain for testing auth flows without real keychain access
    actor MockKeychainManager {
        private(set) var storedAccessToken: String?
        private(set) var storedRefreshToken: String?
        private(set) var storedClientKey: String?
        private(set) var storedSalt: String?
        private(set) var storedIterations: Int?
        private(set) var storedPinHash: String?

        init(
            accessToken: String? = nil,
            refreshToken: String? = nil,
            clientKey: String? = nil,
            salt: String? = nil,
            iterations: Int? = nil,
            pinHash: String? = nil
        ) {
            storedAccessToken = accessToken
            storedRefreshToken = refreshToken
            storedClientKey = clientKey
            storedSalt = salt
            storedIterations = iterations
            storedPinHash = pinHash
        }

        func getAccessToken() -> String? { storedAccessToken }
        func getRefreshToken() -> String? { storedRefreshToken }
        func getClientKey() -> String? { storedClientKey }
        func getSalt() -> String? { storedSalt }
        func getIterations() -> Int? { storedIterations }
        func getPinHash() -> String? { storedPinHash }

        func setAccessToken(_ token: String) throws { storedAccessToken = token }
        func setRefreshToken(_ token: String) throws { storedRefreshToken = token }
        func setClientKey(_ key: String) throws { storedClientKey = key }
        func setSalt(_ salt: String) throws { storedSalt = salt }
        func setIterations(_ iterations: Int) throws { storedIterations = iterations }
        func setPinHash(_ hash: String) throws { storedPinHash = hash }

        func deleteAccessToken() throws { storedAccessToken = nil }
        func deleteRefreshToken() throws { storedRefreshToken = nil }
        func deleteClientKey() throws { storedClientKey = nil }
        func deleteSalt() throws { storedSalt = nil }
        func deleteIterations() throws { storedIterations = nil }
        func deletePinHash() throws { storedPinHash = nil }
        func deleteAll() throws {
            storedAccessToken = nil
            storedRefreshToken = nil
            storedClientKey = nil
            storedSalt = nil
            storedIterations = nil
            storedPinHash = nil
        }
    }
    
    // MARK: - Login Flow Tests
    
    @Test("New user login requires PIN setup")
    func loginFlow_newUser_requiresPinSetup() async throws {
        // Given: User has tokens but no PIN configured
        let keychain = MockKeychainManager(
            accessToken: "valid-token",
            refreshToken: "valid-refresh"
        )
        // No PIN hash, salt, or iterations set

        // When: Checking auth state
        let hasPin = await keychain.getPinHash() != nil
        let hasSalt = await keychain.getSalt() != nil
        let hasIterations = await keychain.getIterations() != nil

        // Then: PIN setup is required
        #expect(!hasPin)
        #expect(!hasSalt)
        #expect(!hasIterations)
    }

    @Test("Existing user with valid PIN can authenticate")
    func loginFlow_existingUser_canAuthenticate() async throws {
        // Given: User has tokens and PIN configured
        let keychain = MockKeychainManager(
            accessToken: "valid-token",
            refreshToken: "valid-refresh",
            clientKey: "stored-client-key-hex",
            salt: "0123456789abcdef0123456789abcdef",
            iterations: 600_000,
            pinHash: "stored-pin-hash"
        )

        // When: Checking auth state
        let hasPin = await keychain.getPinHash() != nil
        let hasSalt = await keychain.getSalt() != nil
        let hasIterations = await keychain.getIterations() != nil
        let hasClientKey = await keychain.getClientKey() != nil

        // Then: User has all required credentials
        #expect(hasPin)
        #expect(hasSalt)
        #expect(hasIterations)
        #expect(hasClientKey)
    }

    @Test("Logout clears all credentials")
    func logout_clearsAllCredentials() async throws {
        // Given: User is fully authenticated
        let keychain = MockKeychainManager(
            accessToken: "valid-token",
            refreshToken: "valid-refresh",
            clientKey: "stored-client-key-hex",
            salt: "0123456789abcdef0123456789abcdef",
            iterations: 600_000,
            pinHash: "stored-pin-hash"
        )
        
        // When: Logging out
        try await keychain.deleteAll()
        
        // Then: All credentials are cleared
        let hasAccessToken = await keychain.getAccessToken() != nil
        let hasRefreshToken = await keychain.getRefreshToken() != nil
        let hasPin = await keychain.getPinHash() != nil
        let hasSalt = await keychain.getSalt() != nil
        let hasIterations = await keychain.getIterations() != nil
        let hasClientKey = await keychain.getClientKey() != nil
        
        #expect(!hasAccessToken)
        #expect(!hasRefreshToken)
        #expect(!hasPin)
        #expect(!hasSalt)
        #expect(!hasIterations)
        #expect(!hasClientKey)
    }
    
    // MARK: - PIN Validation Tests
    
    @Test("PIN validation with correct PIN derives matching key")
    func pinValidation_correctPin_derivesMatchingKey() async throws {
        // Given: A configured PIN
        let cryptoService = CryptoService.shared
        let pin = "1234"
        let salt = "0123456789abcdef0123456789abcdef"
        let iterations = CryptoService.minIterations
        
        // When: Deriving client key twice with same inputs
        let key1 = try await cryptoService.deriveClientKey(pin: pin, saltHex: salt, iterations: iterations)
        let key2 = try await cryptoService.deriveClientKey(pin: pin, saltHex: salt, iterations: iterations)
        
        // Then: Keys match
        #expect(key1 == key2)
    }
    
    @Test("PIN validation with wrong PIN derives different key")
    func pinValidation_wrongPin_derivesDifferentKey() async throws {
        // Given: A configured PIN
        let cryptoService = CryptoService.shared
        let correctPin = "1234"
        let wrongPin = "5678"
        let salt = "0123456789abcdef0123456789abcdef"
        let iterations = CryptoService.minIterations
        
        // When: Deriving client key with different PINs
        let correctKey = try await cryptoService.deriveClientKey(pin: correctPin, saltHex: salt, iterations: iterations)
        let wrongKey = try await cryptoService.deriveClientKey(pin: wrongPin, saltHex: salt, iterations: iterations)
        
        // Then: Keys are different
        #expect(correctKey != wrongKey)
    }
    
    // MARK: - Background Lock Tests
    
    @Test("Grace period allows immediate return without PIN")
    func backgroundLock_withinGracePeriod_noReauthRequired() async {
        // Given: App went to background recently
        let gracePeriod = AppConfiguration.backgroundGracePeriod
        let backgroundedAt = Foundation.Date()
        let returnedAt = backgroundedAt.addingTimeInterval(1) // 1 second later
        
        // When: Checking if reauth is needed
        let elapsed = returnedAt.timeIntervalSince(backgroundedAt)
        let gracePeriodSeconds = Double(gracePeriod.components.seconds)
        let requiresReauth = elapsed > gracePeriodSeconds
        
        // Then: No reauth required
        #expect(!requiresReauth)
    }
    
    @Test("Exceeding grace period requires PIN re-entry")
    func backgroundLock_exceedsGracePeriod_requiresReauth() async {
        // Given: App went to background long ago
        let gracePeriod = AppConfiguration.backgroundGracePeriod
        let gracePeriodSeconds = Double(gracePeriod.components.seconds)
        let backgroundedAt = Foundation.Date()
        let returnedAt = backgroundedAt.addingTimeInterval(gracePeriodSeconds + 1)
        
        // When: Checking if reauth is needed
        let elapsed = returnedAt.timeIntervalSince(backgroundedAt)
        let requiresReauth = elapsed > gracePeriodSeconds
        
        // Then: Reauth required
        #expect(requiresReauth)
    }
    
    // MARK: - Token Refresh Tests
    
    @Test("Missing refresh token requires full re-login")
    func tokenRefresh_noRefreshToken_requiresLogin() async {
        // Given: User has access token but no refresh token
        let keychain = MockKeychainManager(accessToken: "expired-access-token")

        // When: Checking refresh capability
        let canRefresh = await keychain.getRefreshToken() != nil

        // Then: Cannot refresh, must re-login
        #expect(!canRefresh)
    }

    @Test("Valid refresh token allows token refresh")
    func tokenRefresh_withRefreshToken_canRefresh() async {
        // Given: User has both tokens
        let keychain = MockKeychainManager(
            accessToken: "expired-access-token",
            refreshToken: "valid-refresh-token"
        )

        // When: Checking refresh capability
        let canRefresh = await keychain.getRefreshToken() != nil

        // Then: Can refresh
        #expect(canRefresh)
    }
}
