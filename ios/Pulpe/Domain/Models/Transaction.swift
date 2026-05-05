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

    // Currency conversion metadata
    var originalAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
    var exchangeRate: Decimal?

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

    /// Returns a copy with toggled check status
    func toggled() -> Transaction {
        Transaction(
            id: id,
            budgetId: budgetId,
            budgetLineId: budgetLineId,
            name: name,
            amount: amount,
            kind: kind,
            transactionDate: transactionDate,
            category: category,
            checkedAt: isChecked ? nil : Date(),
            createdAt: createdAt,
            updatedAt: Date(),
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            targetCurrency: targetCurrency,
            exchangeRate: exchangeRate
        )
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
    let originalAmount: Decimal?
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    init(
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        budgetLineId: String? = nil,
        transactionDate: Date? = nil,
        category: String? = nil,
        checkedAt: Date? = nil,
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) {
        self.budgetId = budgetId
        self.budgetLineId = budgetLineId
        self.name = name
        self.amount = amount
        self.kind = kind
        self.transactionDate = transactionDate
        self.category = category
        self.checkedAt = checkedAt
        self.originalAmount = originalAmount
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
    }
}

struct TransactionUpdate: Encodable {
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var transactionDate: Date?
    var category: String?
    var originalAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
    var exchangeRate: Decimal?
}
