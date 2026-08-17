import Foundation

/// Decoded shape of `GET /whats-new/ios` — the release notes published between
/// the user's last-seen version and the running binary. `entries` is empty when
/// there is nothing user-facing to show for that range.
struct WhatsNewResponse: Decodable, Sendable {
    let success: Bool
    let data: WhatsNewData

    struct WhatsNewData: Decodable, Sendable {
        let entries: [WhatsNewEntry]
    }
}

struct WhatsNewEntry: Decodable, Sendable, Identifiable {
    let version: String
    let title: String
    let body: String
    let publishedAt: String

    var id: String { version }
}

protocol WhatsNewServiceProtocol: Sendable {
    func fetch(
        currentVersion: String,
        lastSeenVersion: String,
        locale: SupportedLocale
    ) async throws -> WhatsNewResponse
}

/// Fetches the "what's new" release notes for the range between two app versions.
///
/// Unlike `AppVersionService` (public/pre-auth, raw `URLSession`), this endpoint
/// is authenticated: it goes through the shared `APIClient` so the bearer token
/// is attached. Callers are expected to fail open on error.
actor WhatsNewService: WhatsNewServiceProtocol {
    static let shared = WhatsNewService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func fetch(
        currentVersion: String,
        lastSeenVersion: String,
        locale: SupportedLocale
    ) async throws -> WhatsNewResponse {
        try await apiClient.request(
            .whatsNewIos(
                currentVersion: currentVersion,
                lastSeenVersion: lastSeenVersion,
                locale: locale
            )
        )
    }
}
