import Foundation
import Supabase

/// Canonical Pulpe first name from Supabase `user_metadata`.
///
/// Provider `name` is a display full name (Google OpenID Connect). An email,
/// including Apple Private Relay, is never a first name.
enum FirstNameResolver: Sendable {
    /// Trimmed value, or `nil` when empty / whitespace-only.
    static func normalized(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    /// Value that may be written to `user_metadata.firstName`.
    static func nameForPersistence(_ raw: String) throws -> String {
        guard let name = normalized(raw) else {
            throw AuthServiceError.emptyFirstName
        }
        return name
    }

    /// `firstName` (Pulpe) then `given_name` (provider). Never `name` or email.
    static func canonical(from metadata: [String: AnyJSON]) -> String? {
        if case .string(let value) = metadata["firstName"], let name = normalized(value) {
            return name
        }
        if case .string(let value) = metadata["given_name"], let name = normalized(value) {
            return name
        }
        return nil
    }

    /// Overlay a provider `givenName` only when metadata has no canonical first name.
    /// Login with an existing `firstName` must not call this to persist.
    static func applyingProviderGivenName(_ givenName: String?, to user: UserInfo) -> UserInfo {
        if normalized(user.firstName) != nil { return user }
        guard let name = normalized(givenName) else { return user }
        var updated = user
        updated.firstName = name
        return updated
    }

    /// Keep the in-memory given name when the Auth API omits `firstName` after a successful update.
    static func coalescing(_ persisted: UserInfo, fallbackFirstName: String) -> UserInfo {
        var merged = persisted
        merged.firstName = normalized(persisted.firstName) ?? normalized(fallbackFirstName)
        return merged
    }
}
