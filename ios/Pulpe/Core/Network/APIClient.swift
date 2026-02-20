import Foundation
import OSLog

/// Thread-safe API client with token management
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let authTokenProvider: @Sendable () async -> String?
    private let clientKeyProvider: @Sendable () async -> String?

    private init() {
        self.session = Self.makeDefaultSession()
        self.baseURL = AppConfiguration.apiBaseURL
        self.decoder = Self.makeDecoder()
        self.encoder = Self.makeEncoder()
        self.authTokenProvider = {
            await KeychainManager.shared.getAccessToken()
        }
        self.clientKeyProvider = {
            await ClientKeyManager.shared.resolveClientKey()
        }
    }

    init(
        session: URLSession,
        baseURL: URL,
        authTokenProvider: @escaping @Sendable () async -> String?,
        clientKeyProvider: @escaping @Sendable () async -> String?
    ) {
        self.session = session
        self.baseURL = baseURL
        self.decoder = Self.makeDecoder()
        self.encoder = Self.makeEncoder()
        self.authTokenProvider = authTokenProvider
        self.clientKeyProvider = clientKeyProvider
    }

    private static func makeDefaultSession() -> URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = AppConfiguration.requestTimeout
        config.timeoutIntervalForResource = AppConfiguration.resourceTimeout

        // Always fetch from network - caching is handled by Stores (SWR pattern)
        config.requestCachePolicy = .reloadIgnoringLocalCacheData

        return URLSession(configuration: config)
    }

    private static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        let iso8601WithFractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        let iso8601Standard = Date.ISO8601FormatStyle()

        // Configure date decoding for ISO8601 with timezone
        // Reuse parsing strategies captured by the decoder strategy to avoid per-date allocations.
        decoder.dateDecodingStrategy = .custom { dateDecoder in
            let container = try dateDecoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try fractional seconds first (most common)
            if let date = try? iso8601WithFractional.parse(dateString) {
                return date
            }

            // Fallback to standard ISO8601
            if let date = try? iso8601Standard.parse(dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }

        return decoder
    }

    private static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }

    // MARK: - Public API

    /// Perform a request and decode the response
    func request<T: Decodable>(
        _ endpoint: Endpoint,
        body: Encodable? = nil,
        method: HTTPMethod? = nil,
        isRetry: Bool = false
    ) async throws -> T {
        let request = try await buildRequest(endpoint, body: body, method: method)
        return try await performRequest(request, endpoint: endpoint, body: body, isRetry: isRetry)
    }

    /// Perform a request without response body
    func requestVoid(
        _ endpoint: Endpoint,
        body: Encodable? = nil,
        method: HTTPMethod? = nil,
        isRetry: Bool = false
    ) async throws {
        let request = try await buildRequest(endpoint, body: body, method: method)

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            if !isRetry, Self.isTransientError(error) {
                Logger.network.warning("Transient network error, retrying: \(error.localizedDescription, privacy: .public)")
                try await requestVoid(endpoint, body: body, method: method, isRetry: true)
                return
            }
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        // Handle 401 - try token refresh (once only to prevent infinite retry loop)
        if httpResponse.statusCode == 401 {
            guard !isRetry else { throw APIError.unauthorized }
            if try await refreshTokenAndRetry() {
                try await requestVoid(endpoint, body: body, method: method, isRetry: true)
                return
            }
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw try parseError(from: data, statusCode: httpResponse.statusCode)
        }
    }

    // MARK: - Private

    private func buildRequest(
        _ endpoint: Endpoint,
        body: Encodable?,
        method: HTTPMethod?
    ) async throws -> URLRequest {
        var request = endpoint.urlRequest(baseURL: baseURL)

        if let method {
            request.httpMethod = method.rawValue
        }

        if let token = await authTokenProvider(), !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let clientKey = await clientKeyProvider(), !clientKey.isEmpty {
            request.setValue(clientKey, forHTTPHeaderField: "X-Client-Key")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func performRequest<T: Decodable>(
        _ request: URLRequest,
        endpoint: Endpoint,
        body: Encodable?,
        isRetry: Bool = false
    ) async throws -> T {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // Retry once on transient network errors
            if !isRetry, Self.isTransientError(error) {
                Logger.network.warning("Transient network error, retrying: \(error.localizedDescription, privacy: .public)")
                return try await performRequest(request, endpoint: endpoint, body: body, isRetry: true)
            }
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        #if DEBUG
        logRequest(request, response: httpResponse, data: data)
        #endif

        // Handle 401 - try token refresh (once only to prevent infinite retry loop)
        if httpResponse.statusCode == 401 {
            guard !isRetry else { throw APIError.unauthorized }
            if try await refreshTokenAndRetry() {
                return try await self.request(endpoint, body: body, isRetry: true)
            }
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw try parseError(from: data, statusCode: httpResponse.statusCode)
        }

        // Try to decode as APIResponse first
        if let apiResponse = try? decoder.decode(APIResponse<T>.self, from: data) {
            if apiResponse.success, let responseData = apiResponse.data {
                return responseData
            } else if !apiResponse.success {
                throw APIError.from(code: apiResponse.code, message: apiResponse.error ?? apiResponse.message)
            }
        }

        // Fallback: decode directly
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func parseError(from data: Data, statusCode: Int) throws -> APIError {
        // Try to decode error response
        if let errorResponse = try? decoder.decode(APIResponse<EmptyResponse>.self, from: data) {
            let error = APIError.from(
                code: errorResponse.code,
                message: errorResponse.error ?? errorResponse.message
            )

            // Broadcast maintenance notification to trigger UI update
            if case .maintenance = error {
                Task { @MainActor in
                    NotificationCenter.default.post(name: .maintenanceModeDetected, object: nil)
                }
            }

            // Broadcast stale client key to trigger PIN re-entry
            if case .clientKeyInvalid = error {
                Task { @MainActor in
                    NotificationCenter.default.post(name: .clientKeyCheckFailed, object: nil)
                }
            }

            return error
        }

        // Fallback to status code
        switch statusCode {
        case 400:
            return .validationError(details: ["Quelque chose ne colle pas — vérifie ta saisie"])
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 409:
            return .conflict(message: "Cette action entre en conflit — réessaie")
        case 429:
            return .rateLimited
        case 500...599:
            return .serverError(message: "Quelque chose n'a pas fonctionné — réessaie")
        default:
            return .unknown(statusCode: statusCode)
        }
    }

    private func refreshTokenAndRetry() async throws -> Bool {
        // Token refresh is handled by Supabase SDK via AuthService
        // Try to get a fresh token from AuthService
        if let token = await AuthService.shared.getAccessToken(), !token.isEmpty {
            return true
        }
        // Refresh failed — clear tokens and force logout
        await AuthService.shared.logout()
        return false
    }

    /// Transient network errors that are worth retrying once
    private static func isTransientError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .timedOut,
             .networkConnectionLost,
             .dataLengthExceedsMaximum, // -1103 "resource exceeds maximum size"
             .cannotConnectToHost,
             .secureConnectionFailed:
            return true
        default:
            return false
        }
    }

    private func logRequest(_ request: URLRequest, response: HTTPURLResponse, data: Data) {
        let method = request.httpMethod ?? "?"
        let path = request.url?.path ?? "?"
        let status = response.statusCode

        Logger.network.debug("[\(method, privacy: .public)] \(path, privacy: .public) -> \(status, privacy: .public)")
        if status >= 400 {
            Logger.network.error("Request failed: [\(method, privacy: .public)] \(path, privacy: .public) -> \(status, privacy: .public)")
        }
    }
}

// MARK: - Helper Types

private struct EmptyResponse: Decodable {}
