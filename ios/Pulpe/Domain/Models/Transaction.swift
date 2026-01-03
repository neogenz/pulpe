import Foundation

/// Transaction representing an actual financial operation
struct Transaction: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let budgetId: String
    let budgetLineId: String?
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let transactionDate: Date
    let category: String?
    let checkedAt: Date?
    let createdAt: Date
    let updatedAt: Date

    // MARK: - Computed Properties

    var isChecked: Bool {
        checkedAt != nil
    }

    var isAllocated: Bool {
        budgetLineId != nil
    }

    var isFree: Bool {
        budgetLineId == nil
    }
}

// MARK: - Create/Update DTOs

struct TransactionCreate: Encodable {
    let budgetId: String
    let budgetLineId: String?
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let transactionDate: Date?
    let category: String?
    let checkedAt: Date?

    init(
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        budgetLineId: String? = nil,
        transactionDate: Date? = nil,
        category: String? = nil,
        checkedAt: Date? = nil
    ) {
        self.budgetId = budgetId
        self.budgetLineId = budgetLineId
        self.name = name
        self.amount = amount
        self.kind = kind
        self.transactionDate = transactionDate
        self.category = category
        self.checkedAt = checkedAt
    }
}

struct TransactionUpdate: Encodable {
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var transactionDate: Date?
    var category: String?
}
