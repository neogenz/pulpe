import Foundation

/// Service for transaction API operations
actor TransactionService {
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
