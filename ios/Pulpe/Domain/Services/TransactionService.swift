import Foundation

/// Mutation surface of `TransactionService` consumed by `BudgetDetailsCoordinator`.
/// Lets the coordinator be driven by a test double so the deferred soft-delete
/// commit can be asserted deterministically (see `MockTransactionService`).
protocol TransactionServicing: Sendable {
    func deleteTransaction(id: String) async throws
    func toggleCheck(id: String) async throws -> Transaction
    func postpone(id: String) async throws -> Transaction
    func createTransaction(_ data: TransactionCreate) async throws -> Transaction
    func updateTransaction(id: String, data: TransactionUpdate) async throws -> Transaction
}

/// Service for transaction API operations
actor TransactionService: TransactionServicing {
    static let shared = TransactionService()

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - CRUD Operations

    /// Get all transactions for a budget
    func getTransactions(budgetId: String) async throws -> [Transaction] {
        try await apiClient.request(.transactionsByBudget(budgetId: budgetId), method: .get)
    }

    /// Get a specific transaction
    func getTransaction(id: String) async throws -> Transaction {
        try await apiClient.request(.transaction(id: id), method: .get)
    }

    /// Create a new transaction
    func createTransaction(_ data: TransactionCreate) async throws -> Transaction {
        try await apiClient.request(.transactionsCreate, body: data, method: .post)
    }

    /// Update a transaction
    func updateTransaction(id: String, data: TransactionUpdate) async throws -> Transaction {
        try await apiClient.request(.transaction(id: id), body: data, method: .patch)
    }

    /// Delete a transaction
    func deleteTransaction(id: String) async throws {
        try await apiClient.requestVoid(.transaction(id: id), method: .delete)
    }

    // MARK: - Actions

    /// Toggle the checked state of a transaction
    func toggleCheck(id: String) async throws -> Transaction {
        try await apiClient.request(.transactionToggle(id: id), method: .post)
    }

    /// Move an unchecked transaction to next month's budget (PUL-22). Returns
    /// the moved transaction; the backend's extra `sourceBudgetId`/
    /// `targetBudgetId` fields are ignored by `Codable`.
    func postpone(id: String) async throws -> Transaction {
        try await apiClient.request(.transactionPostpone(id: id), method: .post)
    }

    // MARK: - Queries

    /// Get transactions allocated to a specific budget line
    func getAllocatedTransactions(budgetLineId: String, transactions: [Transaction]) -> [Transaction] {
        transactions.filter { $0.budgetLineId == budgetLineId }
    }

    /// Get free (unallocated) transactions
    func getFreeTransactions(_ transactions: [Transaction]) -> [Transaction] {
        transactions.filter { $0.budgetLineId == nil }
    }
}
