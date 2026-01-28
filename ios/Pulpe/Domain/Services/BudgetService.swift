import Foundation

/// Service for budget-related API operations
actor BudgetService {
    static let shared = BudgetService()

    // MARK: - Constants

    /// Default fields for sparse dashboard queries (optimized payload)
    static let defaultSparseFields = "month,year,totalExpenses,totalSavings,rollover"

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - CRUD Operations

    /// Get all budgets for the current user
    func getAllBudgets() async throws -> [Budget] {
        try await apiClient.request(.budgets, method: .get)
    }

    /// Get a specific budget by ID
    func getBudget(id: String) async throws -> Budget {
        try await apiClient.request(.budget(id: id), method: .get)
    }

    /// Get budget with all details (transactions and budget lines)
    func getBudgetWithDetails(id: String) async throws -> BudgetDetails {
        let response: BudgetDetailsResponse = try await apiClient.request(
            .budgetDetails(id: id),
            method: .get
        )
        return response.data
    }

    /// Create a new budget from a template
    func createBudget(_ data: BudgetCreate) async throws -> Budget {
        try await apiClient.request(.budgets, body: data, method: .post)
    }

    /// Update an existing budget
    func updateBudget(id: String, data: BudgetUpdate) async throws -> Budget {
        try await apiClient.request(.budget(id: id), body: data, method: .patch)
    }

    /// Delete a budget
    func deleteBudget(id: String) async throws {
        try await apiClient.requestVoid(.budget(id: id), method: .delete)
    }

    // MARK: - Queries

    /// Find budget for a specific month and year
    func getBudgetForMonth(month: Int, year: Int) async throws -> Budget? {
        let budgets = try await getAllBudgets()
        return budgets.first { $0.month == month && $0.year == year }
    }

    /// Get the current month's budget
    func getCurrentMonthBudget() async throws -> Budget? {
        let now = Date()
        let calendar = Calendar.current
        let month = calendar.component(.month, from: now)
        let year = calendar.component(.year, from: now)
        return try await getBudgetForMonth(month: month, year: year)
    }

    /// Export all budgets (heavy endpoint - use for full data export only)
    func exportAllBudgets() async throws -> BudgetExportData {
        let response: BudgetExportResponse = try await apiClient.request(
            .budgetsExport,
            method: .get
        )
        return response.data
    }

    /// Get budgets with sparse fieldsets (optimized for dashboard)
    /// Returns only requested aggregates without transactions/budget lines
    func getBudgetsSparse(
        fields: String = BudgetService.defaultSparseFields,
        limit: Int? = nil,
        year: Int? = nil
    ) async throws -> [BudgetSparse] {
        let response: BudgetSparseListResponse = try await apiClient.request(
            .budgetsSparse(fields: fields, limit: limit, year: year),
            method: .get
        )
        return response.data
    }

    // MARK: - Helpers

    /// Get next available month for budget creation
    nonisolated func getNextAvailableMonth(existingBudgets: [Budget]) -> (month: Int, year: Int)? {
        let calendar = Calendar.current
        let now = Date()
        let maxYearsAhead = AppConfiguration.maxBudgetYearsAhead

        // Check up to maxYearsAhead * 12 months ahead
        for monthOffset in 0..<(maxYearsAhead * 12) {
            guard let date = calendar.date(byAdding: .month, value: monthOffset, to: now) else {
                continue
            }

            let month = calendar.component(.month, from: date)
            let year = calendar.component(.year, from: date)

            let exists = existingBudgets.contains { $0.month == month && $0.year == year }
            if !exists {
                return (month, year)
            }
        }

        return nil
    }
}
