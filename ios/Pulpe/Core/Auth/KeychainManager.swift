import Foundation
import LocalAuthentication
import OSLog
import Security

/// Thread-safe Keychain manager for secure token storage
actor KeychainManager {
    static let shared = KeychainManager()

    private let service = "app.pulpe.ios"
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let biometricAccessTokenKey = "biometric_access_token"
    private let biometricRefreshTokenKey = "biometric_refresh_token"

    private var isAvailableCache: Bool?

    private init() {}

    // MARK: - Availability

    static func checkAvailability() -> Bool {
        let testKey = "app.pulpe.keychain-test"
        let testData = "test".data(using: .utf8)!

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: testKey,
            kSecValueData as String: testData
        ]

        // Clean up first
        SecItemDelete(addQuery as CFDictionary)

        let status = SecItemAdd(addQuery as CFDictionary, nil)
        SecItemDelete(addQuery as CFDictionary)

        return status == errSecSuccess
    }

    func ensureAvailable() throws {
        if let cached = isAvailableCache {
            guard cached else { throw KeychainError.notAvailable }
            return
        }
        let available = Self.checkAvailability()
        isAvailableCache = available
        guard available else { throw KeychainError.notAvailable }
    }

    // MARK: - Token Management

    func saveTokens(accessToken: String, refreshToken: String) throws {
        try ensureAvailable()

        let accessStatus = saveReturningStatus(key: accessTokenKey, value: accessToken)
        guard accessStatus == errSecSuccess else {
            throw KeychainError.unknown(accessStatus)
        }

        let refreshStatus = saveReturningStatus(key: refreshTokenKey, value: refreshToken)
        guard refreshStatus == errSecSuccess else {
            delete(key: accessTokenKey)
            throw KeychainError.unknown(refreshStatus)
        }
    }

    func getAccessToken() -> String? {
        get(key: accessTokenKey)
    }

    func getRefreshToken() -> String? {
        get(key: refreshTokenKey)
    }

    func clearTokens() {
        delete(key: accessTokenKey)
        delete(key: refreshTokenKey)
    }

    func hasTokens() -> Bool {
        getAccessToken() != nil
    }

    // MARK: - Biometric Token Management

    @discardableResult
    func saveBiometricTokens(accessToken: String, refreshToken: String) -> Bool {
        let accessSaved = saveBiometric(key: biometricAccessTokenKey, value: accessToken)
        guard accessSaved else { return false }

        let refreshSaved = saveBiometric(key: biometricRefreshTokenKey, value: refreshToken)
        guard refreshSaved else {
            delete(key: biometricAccessTokenKey)
            return false
        }

        return true
    }

    func getBiometricAccessToken() throws -> String? {
        try getBiometric(key: biometricAccessTokenKey)
    }

    func getBiometricRefreshToken() throws -> String? {
        try getBiometric(key: biometricRefreshTokenKey)
    }

    func clearBiometricTokens() {
        delete(key: biometricAccessTokenKey)
        delete(key: biometricRefreshTokenKey)
    }

    func hasBiometricTokens() -> Bool {
        let context = LAContext()
        context.interactionNotAllowed = true

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: biometricAccessTokenKey,
            kSecUseAuthenticationContext as String: context
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    // MARK: - Generic Value Storage (for Supabase SDK)

    func saveValue(_ value: String, forKey key: String) {
        save(key: key, value: value)
    }

    func getValue(forKey key: String) -> String? {
        get(key: key)
    }

    func removeValue(forKey key: String) {
        delete(key: key)
    }

    // MARK: - Private Keychain Operations

    private func save(key: String, value: String) {
        let status = saveReturningStatus(key: key, value: value)
        if status != errSecSuccess {
            Logger.auth.error("Keychain save error: \(status)")
        }
    }

    private func saveReturningStatus(key: String, value: String) -> OSStatus {
        guard let data = value.data(using: .utf8) else { return errSecParam }

        let deleteStatus = delete(key: key)
        guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound else {
            return deleteStatus
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        return SecItemAdd(query as CFDictionary, nil)
    }

    private func get(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    @discardableResult
    private func delete(key: String) -> OSStatus {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        return SecItemDelete(query as CFDictionary)
    }

    // MARK: - Private Biometric Keychain Operations

    @discardableResult
    private func saveBiometric(key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }

        let deleteStatus = delete(key: key)
        guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound else {
            return false
        }

        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &error
        ) else {
            Logger.auth.error("Keychain access control error: \(String(describing: error))")
            return false
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        if status != errSecSuccess {
            Logger.auth.error("Keychain biometric save error: \(status)")
            return false
        }
        return true
    }

    private func getBiometric(key: String) throws -> String? {
        let context = LAContext()
        context.interactionNotAllowed = false

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            guard let data = result as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                return nil
            }
            return value
        case errSecItemNotFound:
            return nil
        case errSecUserCanceled:
            throw KeychainError.userCanceled
        case errSecAuthFailed:
            throw KeychainError.authFailed
        default:
            throw KeychainError.unknown(status)
        }
    }
}

// MARK: - Keychain Errors

enum KeychainError: LocalizedError {
    case notAvailable
    case userCanceled
    case authFailed
    case unknown(OSStatus)

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Le trousseau n'est pas disponible sur cet appareil"
        case .userCanceled:
            return "Authentification annulée"
        case .authFailed:
            return "L'authentification n'a pas fonctionné — réessaye"
        case .unknown(let status):
            return "Quelque chose n'a pas fonctionné (code: \(status))"
        }
    }
}
