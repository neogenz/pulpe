import Foundation

/// Mutation surface of `BudgetLineService` consumed by `BudgetDetailsCoordinator`.
/// Lets the coordinator be driven by a test double so the deferred soft-delete
/// commit can be asserted deterministically (see `MockBudgetLineService`).
protocol BudgetLineServicing: Sendable {
    func deleteBudgetLine(id: String) async throws
    func toggleCheck(id: String) async throws -> BudgetLine
    func postpone(id: String) async throws -> BudgetLine
}

/// Service for budget line API operations
actor BudgetLineService: BudgetLineServicing {
    static let shared = BudgetLineService()

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - CRUD Operations

    /// Get all budget lines for a budget
    func getBudgetLines(budgetId: String) async throws -> [BudgetLine] {
        try await apiClient.request(.budgetLines(budgetId: budgetId), method: .get)
    }

    /// Get a specific budget line
    func getBudgetLine(id: String) async throws -> BudgetLine {
        try await apiClient.request(.budgetLine(id: id), method: .get)
    }

    /// Create a new budget line
    func createBudgetLine(_ data: BudgetLineCreate) async throws -> BudgetLine {
        try await apiClient.request(.budgetLinesCreate, body: data, method: .post)
    }

    /// Update a budget line
    func updateBudgetLine(id: String, data: BudgetLineUpdate) async throws -> BudgetLine {
        try await apiClient.request(.budgetLine(id: id), body: data, method: .patch)
    }

    /// Delete a budget line
    func deleteBudgetLine(id: String) async throws {
        try await apiClient.requestVoid(.budgetLine(id: id), method: .delete)
    }

    // MARK: - Actions

    /// Toggle the checked state of a budget line
    func toggleCheck(id: String) async throws -> BudgetLine {
        try await apiClient.request(.budgetLineToggle(id: id), method: .post)
    }

    /// Move an unchecked, one-off budget line to next month's budget (PUL-22).
    /// Returns the moved line (the `success`/`data` envelope is unwrapped by
    /// the APIClient; the extra `sourceBudgetId`/`targetBudgetId` fields the
    /// backend appends are ignored by `Codable`).
    func postpone(id: String) async throws -> BudgetLine {
        try await apiClient.request(.budgetLinePostpone(id: id), method: .post)
    }

    /// Reset a budget line to its template value
    func resetFromTemplate(id: String) async throws -> BudgetLine {
        try await apiClient.request(.budgetLineResetFromTemplate(id: id), method: .post)
    }
}
