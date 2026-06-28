import Foundation

/// Mutation surface of `BudgetLineService` consumed by `BudgetDetailsCoordinator`.
/// Lets the coordinator be driven by a test double so the deferred soft-delete
/// commit can be asserted deterministically (see `MockBudgetLineService`).
protocol BudgetLineServicing: Sendable {
    func deleteBudgetLine(id: String) async throws
    func toggleCheck(id: String) async throws -> BudgetLine
    func createSpread(_ data: BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse
    func getSpreadOccurrences(spreadGroupId: String) async throws -> [SpreadOccurrence]
    func spreadExistingBudgetLine(
        id: String,
        periods: [SpreadFromExistingPeriod]
    ) async throws -> BudgetLineSpreadResponse
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

    /// Fan out a "Lisser" expense into N independent `one_off` lines, one per
    /// selected month (PUL-17). The server auto-creates missing budgets from the
    /// default template and shares one frozen `exchangeRate` across all tranches.
    func createSpread(_ data: BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse {
        try await apiClient.request(.budgetLinesSpread, body: data, method: .post)
    }

    /// Fetch every occurrence of a "Lisser" expense, one per host month (PUL-17
    /// Lot C). Drives the read-only occurrences sheet.
    func getSpreadOccurrences(spreadGroupId: String) async throws -> [SpreadOccurrence] {
        try await apiClient.request(.budgetLinesSpreadOccurrences(spreadGroupId: spreadGroupId), method: .get)
    }

    /// Lisse une prévision EXISTANTE en préservant son total (PUL-17 v1.1) :
    /// le serveur lit le total T de la source, le redistribue en T/N sur les
    /// `periods`, puis supprime la source — le tout dans une seule transaction.
    func spreadExistingBudgetLine(
        id: String,
        periods: [SpreadFromExistingPeriod]
    ) async throws -> BudgetLineSpreadResponse {
        try await apiClient.request(
            .budgetLineSpreadFromLine(id: id),
            body: SpreadFromExistingCreate(periods: periods),
            method: .post
        )
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
