import Foundation
import OSLog
import Security
import Supabase

/// Single source of truth for live Supabase session tokens.
/// Conforms to Supabase SDK's `AuthLocalStorage` (sync, throwing) so the SDK
/// owns persistence across launches and silent token refreshes — eliminating
/// drift between custom keychain slots that previously triggered
/// refresh-token-reuse detection on cold-start biometric paths (PUL-132).
public struct PulpeAuthStorage: AuthLocalStorage {
    public static let sessionStorageKey = "supabase.auth.token"

    private let service: String

    public init(service: String = "app.pulpe.ios") {
        self.service = service
    }

    public func store(key: String, value: Data) throws {
        let baseQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let updateAttributes: [String: Any] = [
            kSecValueData as String: value,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let updateStatus = SecItemUpdate(baseQuery as CFDictionary, updateAttributes as CFDictionary)
        switch updateStatus {
        case errSecSuccess:
            return
        case errSecItemNotFound:
            break
        default:
            let deleteStatus = SecItemDelete(baseQuery as CFDictionary)
            Logger.auth.warning(
                "PulpeAuthStorage update failed (\(updateStatus)), delete=\(deleteStatus) for key: \(key)"
            )
            guard deleteStatus == errSecSuccess || deleteStatus == errSecItemNotFound else {
                // Preserve original failure cause (update) — delete was best-effort cleanup.
                throw PulpeAuthStorageError.storeFailed(updateStatus)
            }
        }

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: value,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        // errSecDuplicateItem: a concurrent writer (e.g. SDK auto-refresh timer)
        // re-inserted the item between our SecItemDelete and SecItemAdd. Treat
        // as success — the slot now holds a more recent value than ours would.
        guard addStatus == errSecSuccess || addStatus == errSecDuplicateItem else {
            throw PulpeAuthStorageError.storeFailed(addStatus)
        }
    }

    public func retrieve(key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            return result as? Data
        case errSecItemNotFound:
            return nil
        default:
            throw PulpeAuthStorageError.retrieveFailed(status)
        }
    }

    public func remove(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw PulpeAuthStorageError.removeFailed(status)
        }
    }
}

public enum PulpeAuthStorageError: Error, Equatable {
    case storeFailed(OSStatus)
    case retrieveFailed(OSStatus)
    case removeFailed(OSStatus)
}
