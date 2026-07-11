import Foundation

/// Read/write surface of `SavingsGoalService`. A protocol so `SavingsGoalStore`
/// can be driven by a test double.
protocol SavingsGoalServicing: Sendable {
    func getAll() async throws -> [SavingsGoal]
    func get(id: String) async throws -> SavingsGoal
    func getProgress(id: String) async throws -> SavingsGoalProgress
    func getContributions(id: String) async throws -> [SavingsGoalContribution]
    func applyPlan(id: String, _ payload: SavingsGoalPlanApply) async throws -> SavingsGoalPlanApplyResult
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

    /// Fetches the derived progression (PUL-8). The backend computes every figure.
    func getProgress(id: String) async throws -> SavingsGoalProgress {
        try await apiClient.request(.savingsGoalProgress(id: id), method: .get)
    }

    func getContributions(id: String) async throws -> [SavingsGoalContribution] {
        try await apiClient.request(.savingsGoalContributions(id: id), method: .get)
    }

    /// Applies an edited plan (PUL-12+, `docs/SAVINGS_PLAN.md` §4.3). Pessimistic,
    /// atomic write; the backend re-encrypts amounts, recalculates touched budgets
    /// and returns the decrypted lines. Idempotent by construction (UPDATE-by-value).
    func applyPlan(id: String, _ payload: SavingsGoalPlanApply) async throws -> SavingsGoalPlanApplyResult {
        try await apiClient.request(.savingsGoalPlanApply(id: id), body: payload, method: .post)
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
