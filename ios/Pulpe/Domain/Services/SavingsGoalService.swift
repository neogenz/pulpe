import Foundation

/// Read/write surface of `SavingsGoalService`. A protocol so `SavingsGoalStore`
/// can be driven by a test double.
protocol SavingsGoalServicing: Sendable {
    func getAll() async throws -> [SavingsGoal]
    func get(id: String) async throws -> SavingsGoal
    func getProgress(id: String) async throws -> SavingsGoalProgress
    func getContributions(id: String) async throws -> [SavingsGoalContribution]
    func applyPlan(id: String, _ payload: SavingsGoalPlanApply) async throws -> SavingsGoalPlanApplyResult
    func getFutureLines(id: String, targetDate: String?) async throws -> [SavingsGoalFutureLine]
    func applyGenerationStop(
        id: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult
    func getDeletionImpact(id: String) async throws -> SavingsGoalDeletionImpact
    func delete(id: String, command: SavingsGoalDeletionCommand) async throws
    func getWithdrawalOptions() async throws -> [SavingsGoalWithdrawalOption]
    func getWithdrawals(id: String) async throws -> SavingsGoalWithdrawalsReadModel
    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal
    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal
}

extension SavingsGoalServicing {
    func getFutureLines(id: String) async throws -> [SavingsGoalFutureLine] {
        try await getFutureLines(id: id, targetDate: nil)
    }
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

    /// Applies an edited plan (PUL-12+, `docs/SAVINGS.md` §10.4). Pessimistic,
    /// atomic write; the backend re-encrypts amounts, recalculates touched budgets
    /// and returns the decrypted lines. Idempotent by construction (UPDATE-by-value).
    func applyPlan(id: String, _ payload: SavingsGoalPlanApply) async throws -> SavingsGoalPlanApplyResult {
        try await apiClient.request(.savingsGoalPlanApply(id: id), body: payload, method: .post)
    }

    /// Advisory candidates at generation stop (PUL-285 CA5): linked, unchecked,
    /// non-manually-adjusted lines of the current payDay cycle and beyond.
    func getFutureLines(id: String, targetDate: String?) async throws -> [SavingsGoalFutureLine] {
        try await apiClient.request(
            .savingsGoalFutureLines(id: id, targetDate: targetDate),
            method: .get
        )
    }

    /// Applies the explicit freeze/remove decision (PUL-285 CA8). Atomic —
    /// any ineligible line refuses the whole batch server-side.
    func applyGenerationStop(
        id: String,
        _ payload: SavingsGoalGenerationStop
    ) async throws -> SavingsGoalGenerationStopResult {
        try await apiClient.request(.savingsGoalGenerationStop(id: id), body: payload, method: .post)
    }

    func getDeletionImpact(id: String) async throws -> SavingsGoalDeletionImpact {
        try await apiClient.request(.savingsGoalDeletionImpact(id: id), method: .get)
    }

    func delete(id: String, command: SavingsGoalDeletionCommand) async throws {
        try await apiClient.requestVoid(.savingsGoalDeletion(id: id), body: command, method: .post)
    }

    /// Goals that can fund an income right now (PUL-329). The server filters on the
    /// confirmed balance, so an empty array means "nothing available", not "no goal".
    func getWithdrawalOptions() async throws -> [SavingsGoalWithdrawalOption] {
        try await apiClient.request(.savingsGoalWithdrawalOptions, method: .get)
    }

    func getWithdrawals(id: String) async throws -> SavingsGoalWithdrawalsReadModel {
        try await apiClient.request(.savingsGoalWithdrawals(id: id), method: .get)
    }

    func create(_ data: SavingsGoalCreate) async throws -> SavingsGoal {
        try await apiClient.request(.savingsGoals, body: data, method: .post)
    }

    func update(id: String, data: SavingsGoalUpdate) async throws -> SavingsGoal {
        try await apiClient.request(.savingsGoal(id: id), body: data, method: .patch)
    }
}
