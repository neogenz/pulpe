import Foundation

/// Thread-safe API client with token management
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = AppConfiguration.requestTimeout
        config.timeoutIntervalForResource = AppConfiguration.resourceTimeout

        self.session = URLSession(configuration: config)
        self.baseURL = AppConfiguration.apiBaseURL
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()

        // Configure date decoding for ISO8601 with timezone
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try ISO8601 with fractional seconds (using cached formatter)
            if let date = Formatters.iso8601WithFractional.date(from: dateString) {
                return date
            }

            // Fallback to without fractional seconds
            if let date = Formatters.iso8601.date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }

        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Public API

    /// Perform a request and decode the response
    func request<T: Decodable>(
        _ endpoint: Endpoint,
        body: Encodable? = nil,
        method: HTTPMethod? = nil
    ) async throws -> T {
        var request = endpoint.urlRequest(baseURL: baseURL)

        // Override method if specified
        if let method {
            request.httpMethod = method.rawValue
        }

        // Add auth token
        if let token = await KeychainManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Add body
        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        request.setValue("application/json", forHTTPHeaderField: "Accept")

        return try await performRequest(request, endpoint: endpoint, body: body)
    }

    /// Perform a request without response body
    func requestVoid(
        _ endpoint: Endpoint,
        body: Encodable? = nil,
        method: HTTPMethod? = nil
    ) async throws {
        var request = endpoint.urlRequest(baseURL: baseURL)

        if let method {
            request.httpMethod = method.rawValue
        }

        if let token = await KeychainManager.shared.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        // Handle 401 - try token refresh
        if httpResponse.statusCode == 401 {
            if try await refreshTokenAndRetry() {
                try await requestVoid(endpoint, body: body, method: method)
                return
            }
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw try parseError(from: data, statusCode: httpResponse.statusCode)
        }
    }

    // MARK: - Private

    private func performRequest<T: Decodable>(
        _ request: URLRequest,
        endpoint: Endpoint,
        body: Encodable?
    ) async throws -> T {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        #if DEBUG
        logRequest(request, response: httpResponse, data: data)
        #endif

        // Handle 401 - try token refresh
        if httpResponse.statusCode == 401 {
            if try await refreshTokenAndRetry() {
                return try await self.request(endpoint, body: body)
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
        if let token = await AuthService.shared.getAccessToken() {
            return !token.isEmpty
        }
        return false
    }

    #if DEBUG
    private func logRequest(_ request: URLRequest, response: HTTPURLResponse, data: Data) {
        let method = request.httpMethod ?? "?"
        let url = request.url?.absoluteString ?? "?"
        let status = response.statusCode
        let dataPreview = String(data: data.prefix(500), encoding: .utf8) ?? "Binary data"

        print("[\(method)] \(url) -> \(status)")
        if status >= 400 {
            print("Response: \(dataPreview)")
        }
    }
    #endif
}

// MARK: - Helper Types

private struct EmptyResponse: Decodable {}
