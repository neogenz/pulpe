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
}
