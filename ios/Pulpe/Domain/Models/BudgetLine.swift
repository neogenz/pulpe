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

    init(
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        templateLineId: String? = nil,
        savingsGoalId: String? = nil,
        isManuallyAdjusted: Bool = false,
        checkedAt: Date? = nil
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
    }
}

struct BudgetLineUpdate: Encodable {
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var recurrence: TransactionRecurrence?
    var isManuallyAdjusted: Bool?
    var checkedAt: Date?
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
            amount: amount,
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
