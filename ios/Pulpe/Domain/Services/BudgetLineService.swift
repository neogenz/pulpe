import Foundation

/// Service for budget line API operations
actor BudgetLineService {
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
        try await apiClient.request(.budgetLines(budgetId: data.budgetId), body: data, method: .post)
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

    /// Reset a budget line to its template value
    func resetFromTemplate(id: String) async throws -> BudgetLine {
        try await apiClient.request(.budgetLineResetFromTemplate(id: id), method: .post)
    }
}
