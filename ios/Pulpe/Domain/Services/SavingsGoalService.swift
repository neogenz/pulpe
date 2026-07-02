import Foundation

/// Read/write surface of `SavingsGoalService`. A protocol so `SavingsGoalStore`
/// can be driven by a test double.
protocol SavingsGoalServicing: Sendable {
    func getAll() async throws -> [SavingsGoal]
    func get(id: String) async throws -> SavingsGoal
    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal
    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal
    func delete(id: String) async throws
}

/// Service for savings-goal API operations (PUL-12). The backend wraps responses
/// in `{ success, data }`; `APIClient` unwraps that automatically.
actor SavingsGoalService: SavingsGoalServicing {
    static let shared = SavingsGoalService()

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [SavingsGoal] {
        try await apiClient.request(.savingsGoals, method: .get)
    }

    func get(id: String) async throws -> SavingsGoal {
        try await apiClient.request(.savingsGoal(id: id), method: .get)
    }

    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        try await apiClient.request(.savingsGoals, body: data, method: .post)
    }

    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        try await apiClient.request(.savingsGoal(id: id), body: data, method: .patch)
    }

    func delete(id: String) async throws {
        try await apiClient.requestVoid(.savingsGoal(id: id), method: .delete)
    }
}
