import Foundation
@testable import Pulpe
import Testing

@Suite("Feedback service", .serialized)
struct FeedbackServiceTests {
    private let baseURL = URL(string: "https://pulpe.test/v1") ?? URL(fileURLWithPath: "/")

    @Test
    func submit_sendsAuthenticatedPostWithMinimalPayload_andAccepts204() async throws {
        let recorder = FeedbackRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 204), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = FeedbackService(apiClient: makeAPIClient())
        try await service.submit(
            FeedbackSubmission(
                overallRating: .good,
                appVersion: "1.4.3",
                iosVersion: "26.0"
            )
        )

        let request = try #require(recorder.request)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/v1/feedback")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer feedback-token")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(try jsonObject(from: request) == [
            "overallRating": 4,
            "appVersion": "1.4.3",
            "iosVersion": "26.0",
        ])
    }

    @Test
    func submit_encodesEveryOptionalFieldWithContractNames() async throws {
        let recorder = FeedbackRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (makeHTTPResponse(for: request, statusCode: 204), Data())
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = FeedbackService(apiClient: makeAPIClient())
        try await service.submit(
            FeedbackSubmission(
                overallRating: .veryGood,
                ratings: [
                    .onboarding: .good,
                    .budgetClarity: .okay,
                    .currentMonth: .veryGood,
                    .futurePlanning: .difficult,
                    .homeClarity: .good,
                ],
                comment: "Simple et clair",
                appVersion: "1.4.3",
                iosVersion: "26.0"
            )
        )

        let request = try #require(recorder.request)
        #expect(try jsonObject(from: request) == [
            "overallRating": 5,
            "onboarding": 4,
            "budgetClarity": 3,
            "currentMonth": 5,
            "futurePlanning": 2,
            "homeClarity": 4,
            "comment": "Simple et clair",
            "appVersion": "1.4.3",
            "iosVersion": "26.0",
        ])
    }

    private func makeAPIClient() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        return APIClient(
            session: URLSession(configuration: configuration),
            baseURL: baseURL,
            authTokenProvider: { "feedback-token" },
            clientKeyProvider: { nil }
        )
    }

    private func jsonObject(from request: URLRequest) throws -> NSDictionary {
        let body = try #require(request.httpBody)
        return try #require(JSONSerialization.jsonObject(with: body) as? NSDictionary)
    }
}

private final class FeedbackRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedRequest: URLRequest?

    func record(_ request: URLRequest) {
        var capturedRequest = request
        if capturedRequest.httpBody == nil, let stream = capturedRequest.httpBodyStream {
            stream.open()
            defer { stream.close() }

            var body = Data()
            var buffer = [UInt8](repeating: 0, count: 1_024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                guard count > 0 else { break }
                body.append(buffer, count: count)
            }
            capturedRequest.httpBody = body
        }

        lock.lock()
        defer { lock.unlock() }
        storedRequest = capturedRequest
    }

    var request: URLRequest? {
        lock.lock()
        defer { lock.unlock() }
        return storedRequest
    }
}
