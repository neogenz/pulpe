import Foundation
import OSLog

/// Decoded shape of `GET /api/v1/app/version` — mirrors `appVersionResponseSchema`
/// in `shared/schemas.ts`.
struct AppVersionResponse: Decodable, Sendable {
    let success: Bool
    let data: AppVersionData

    struct AppVersionData: Decodable, Sendable {
        let ios: PlatformVersion
        let web: PlatformVersion
    }

    struct PlatformVersion: Decodable, Sendable {
        let minVersion: String
        let latestVersion: String
        let storeUrl: String?
    }
}

protocol AppVersionServiceProtocol: Sendable {
    func fetch() async throws -> AppVersionResponse
}

/// Fetches the server-published version floor for the current platform.
///
/// Uses `URLSession` directly (not `APIClient`) because the endpoint is
/// public and pre-auth — the app must be able to discover a forced update
/// before the user is signed in. A short 3s timeout keeps the launch path
/// fast; callers are expected to treat any error as fail-open.
actor AppVersionService: AppVersionServiceProtocol {
    static let shared = AppVersionService()

    private static let requestTimeoutSeconds: TimeInterval = 3
    private static let endpointPath = "app/version"

    private let session: URLSession
    private let baseURL: URL

    init(baseURL: URL = AppConfiguration.apiBaseURL) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = Self.requestTimeoutSeconds
        configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        self.session = URLSession(configuration: configuration)
        self.baseURL = baseURL
    }

    func fetch() async throws -> AppVersionResponse {
        let url = baseURL.appendingPathComponent(Self.endpointPath)
        // The endpoint is public/pre-auth and the store fails open, so any
        // failure here would otherwise vanish — log it once (transport OR
        // decode) so a broken gate (Railway deploy, CDN misconfig, 5xx,
        // malformed payload) is visible in monitoring.
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            Logger.network.warning(
                """
                [FORCE-UPDATE] version endpoint unreachable — gate cannot refresh, fails open. \
                url=\(url.absoluteString, privacy: .public) \
                error=\(error.localizedDescription, privacy: .public)
                """
            )
            throw error
        }

        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
        do {
            return try JSONDecoder().decode(AppVersionResponse.self, from: data)
        } catch {
            Logger.network.warning(
                """
                [FORCE-UPDATE] version response unusable (HTTP \(statusCode)) — gate cannot refresh, fails open. \
                url=\(url.absoluteString, privacy: .public) \
                error=\(error.localizedDescription, privacy: .public)
                """
            )
            throw error
        }
    }
}
