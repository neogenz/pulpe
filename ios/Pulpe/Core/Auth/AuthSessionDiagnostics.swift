import Foundation
import Supabase

enum AuthSessionDiagnostics {
    static func isDecodableSession(_ data: Data) -> Bool {
        (try? JSONDecoder().decode(Session.self, from: data)) != nil
    }

    static func capture(source: String, outcome: String, session: Session?) {
        AnalyticsService.captureAuthSessionDiagnostic(
            source: source,
            outcome: outcome,
            storageState: session == nil ? "missing" : "available",
            accessTokenExpiresInSeconds: session.map {
                Int($0.expiresAt - Date().timeIntervalSince1970)
            }
        )
    }

    static func capturePersisted(
        source: String,
        outcome: String,
        storage: any AuthLocalStorage
    ) {
        do {
            guard let blob = try storage.retrieve(key: PulpeAuthStorage.sessionStorageKey) else {
                AnalyticsService.captureAuthSessionDiagnostic(
                    source: source,
                    outcome: outcome,
                    storageState: "missing"
                )
                return
            }
            guard let session = try? JSONDecoder().decode(Session.self, from: blob) else {
                AnalyticsService.captureAuthSessionDiagnostic(
                    source: source,
                    outcome: outcome,
                    storageState: "undecodable"
                )
                return
            }
            capture(source: source, outcome: outcome, session: session)
        } catch {
            AnalyticsService.captureAuthSessionDiagnostic(
                source: source,
                outcome: outcome,
                storageState: "unreadable"
            )
        }
    }
}

extension AuthService {
    static func isTerminalSessionFailure(_ error: any Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        if case .sessionMissing = authError { return true }
        return false
    }

    static func isConfirmedTerminalSessionFailure(
        _ error: any Error,
        persistedSessionExists: Bool
    ) -> Bool {
        isTerminalSessionFailure(error) && !persistedSessionExists
    }
}

/// Captures only Supabase's terminal session code. The SDK otherwise maps four
/// different server responses to `sessionMissing` after deleting local storage.
/// Request bodies and logger context contain refresh tokens and are never forwarded.
struct PulpeSupabaseLogger: SupabaseLogger {
    private static let cleanupCodes: Set<String> = [
        "session_not_found",
        "session_expired",
        "refresh_token_not_found",
        "refresh_token_already_used"
    ]

    func log(message: SupabaseLogMessage) {
        guard let (code, status) = Self.cleanupError(from: message.message) else { return }
        AnalyticsService.captureAuthSessionDiagnostic(
            source: "supabase_auth_response",
            outcome: code,
            status: status
        )
    }

    static func cleanupError(from message: String) -> (code: String, status: Int)? {
        let prefix = "Response: Status code: "
        guard message.hasPrefix(prefix),
              let status = Int(message.dropFirst(prefix.count).prefix(while: \.isNumber)),
              let bodyRange = message.range(of: "\nBody: "),
              let data = String(message[bodyRange.upperBound...]).data(using: .utf8),
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = (body["code"] as? String) ?? (body["error_code"] as? String),
              cleanupCodes.contains(code) else {
            return nil
        }
        return (code, status)
    }
}
