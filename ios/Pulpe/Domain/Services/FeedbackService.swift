import Foundation

protocol FeedbackServicing: Sendable {
    func submit(_ feedback: FeedbackSubmission) async throws
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
}
