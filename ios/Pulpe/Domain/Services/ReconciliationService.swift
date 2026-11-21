import Foundation

/// « Comparer avec mes comptes » on the server: the context of a comparison, and its state.
actor ReconciliationService {
    static let shared = ReconciliationService()

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getContext(budgetId: String) async throws -> ReconciliationContext {
        try await apiClient.request(.reconciliationContext(budgetId: budgetId), method: .get)
    }

    func updateState(_ update: ReconciliationStateUpdate) async throws -> ReconciliationState {
        try await apiClient.request(.reconciliationState, body: update, method: .put)
    }
}
