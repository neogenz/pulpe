import Foundation
import LocalAuthentication
import Security

/// Thread-safe Keychain manager for secure token storage
actor KeychainManager {
    static let shared = KeychainManager()

    private let service = "app.pulpe.ios"
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let biometricAccessTokenKey = "biometric_access_token"
    private let biometricRefreshTokenKey = "biometric_refresh_token"

    private init() {}

    // MARK: - Token Management

    func saveTokens(accessToken: String, refreshToken: String) {
        save(key: accessTokenKey, value: accessToken)
        save(key: refreshTokenKey, value: refreshToken)
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

    func saveBiometricTokens(accessToken: String, refreshToken: String) {
        saveBiometric(key: biometricAccessTokenKey, value: accessToken)
        saveBiometric(key: biometricRefreshTokenKey, value: refreshToken)
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
        guard let data = value.data(using: .utf8) else { return }

        // Delete existing item first
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        #if DEBUG
        if status != errSecSuccess {
            print("Keychain save error: \(status)")
        }
        #endif
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

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Private Biometric Keychain Operations

    private func saveBiometric(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        delete(key: key)

        var error: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .biometryCurrentSet,
            &error
        ) else {
            #if DEBUG
            print("Keychain access control error: \(String(describing: error))")
            #endif
            return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: accessControl
        ]

        let status = SecItemAdd(query as CFDictionary, nil)

        #if DEBUG
        if status != errSecSuccess {
            print("Keychain biometric save error: \(status)")
        }
        #endif
    }

    private func getBiometric(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUIAllow
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
    case userCanceled
    case authFailed
    case unknown(OSStatus)

    var errorDescription: String? {
        switch self {
        case .userCanceled:
            return "L'authentification a été annulée."
        case .authFailed:
            return "L'authentification a échoué."
        case .unknown(let status):
            return "Erreur Keychain: \(status)"
        }
    }
}
