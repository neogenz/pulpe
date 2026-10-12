import Foundation

protocol FeedbackServicing: Sendable {
    func submit(_ feedback: FeedbackSubmission) async throws
    func hasSubmitted() async throws -> Bool
}

actor FeedbackService: FeedbackServicing {
    static let shared = FeedbackService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func submit(_ feedback: FeedbackSubmission) async throws {
        try await apiClient.requestVoid(.feedback, body: feedback)
    }

    /// Whether the account already answered, on any platform.
    func hasSubmitted() async throws -> Bool {
        let response: FeedbackStatusResponse = try await apiClient.request(.feedbackStatus, method: .get)
        return response.hasSubmitted
    }
}
