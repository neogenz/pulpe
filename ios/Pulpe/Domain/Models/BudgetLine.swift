import Foundation

/// Budget line representing a planned financial item (income, expense, or saving)
struct BudgetLine: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let budgetId: String
    let templateLineId: String?
    let savingsGoalId: String?
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let recurrence: TransactionRecurrence
    let isManuallyAdjusted: Bool
    let checkedAt: Date?
    let createdAt: Date
    let updatedAt: Date

    // Currency conversion metadata
    var originalAmount: Decimal?
    var originalCurrency: String?
    var exchangeRate: Decimal?

    // Virtual rollover fields (added client-side)
    var isRollover: Bool?
    var rolloverSourceBudgetId: String?

    // MARK: - Computed Properties

    var isChecked: Bool {
        checkedAt != nil
    }

    var isFromTemplate: Bool {
        templateLineId != nil
    }

    var isVirtualRollover: Bool {
        isRollover == true
    }

    /// Returns a copy with toggled check status
    func toggled() -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: budgetId,
            templateLineId: templateLineId,
            savingsGoalId: savingsGoalId,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: recurrence,
            isManuallyAdjusted: isManuallyAdjusted,
            checkedAt: isChecked ? nil : Date(),
            createdAt: createdAt,
            updatedAt: Date(),
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            exchangeRate: exchangeRate,
            isRollover: isRollover,
            rolloverSourceBudgetId: rolloverSourceBudgetId
        )
    }
}

// MARK: - Create/Update DTOs

struct BudgetLineCreate: Encodable {
    let budgetId: String
    let templateLineId: String?
    let savingsGoalId: String?
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let recurrence: TransactionRecurrence
    let isManuallyAdjusted: Bool
    let checkedAt: Date?
    let originalAmount: Decimal?
    let originalCurrency: String?
    let targetCurrency: String?
    let exchangeRate: Decimal?

    init(
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        templateLineId: String? = nil,
        savingsGoalId: String? = nil,
        isManuallyAdjusted: Bool = false,
        checkedAt: Date? = nil,
        originalAmount: Decimal? = nil,
        originalCurrency: String? = nil,
        targetCurrency: String? = nil,
        exchangeRate: Decimal? = nil
    ) {
        self.budgetId = budgetId
        self.templateLineId = templateLineId
        self.savingsGoalId = savingsGoalId
        self.name = name
        self.amount = amount
        self.kind = kind
        self.recurrence = recurrence
        self.isManuallyAdjusted = isManuallyAdjusted
        self.checkedAt = checkedAt
        self.originalAmount = originalAmount
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
    }
}

struct BudgetLineUpdate: Encodable {
    let id: String
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var isManuallyAdjusted: Bool?
    var checkedAt: Date?
    var originalAmount: Decimal?
    var originalCurrency: String?
    var targetCurrency: String?
    var exchangeRate: Decimal?
}

// MARK: - Collection Helpers

extension Array where Element == BudgetLine {
    /// Filter budget lines by kind, sorted by creation date (newest first)
    func byKind(_ kind: TransactionKind) -> [BudgetLine] {
        filter { $0.kind == kind }.sorted { $0.createdAt > $1.createdAt }
    }
}

// MARK: - Virtual Rollover Line Factory

extension BudgetLine {
    /// Create a virtual rollover budget line for display purposes
    static func rolloverLine(amount: Decimal, budgetId: String, sourceBudgetId: String?) -> BudgetLine {
        BudgetLine(
            id: "rollover-\(budgetId)",
            budgetId: budgetId,
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Report du mois précédent",
            amount: abs(amount),
            kind: amount >= 0 ? .income : .expense,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: Date(), // Always checked
            createdAt: Date(),
            updatedAt: Date(),
            isRollover: true,
            rolloverSourceBudgetId: sourceBudgetId
        )
    }
}
