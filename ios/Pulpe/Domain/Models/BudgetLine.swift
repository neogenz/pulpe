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

    var tagIds: [String]?

    /// Shared identifier of the spread group when this line is one occurrence of a
    /// "Lisser" expense (PUL-17). Non-financial UUID — never encrypted. `nil` for
    /// ordinary lines. Generated server-side by `POST /budget-lines/spread`.
    var spreadGroupId: UUID?

    /// Shared identifier of the Revenu-M ↔ Épargne-(M+1) couple created by
    /// "piocher dans son épargne" (PUL-292). Light link — drives the badge on the
    /// income line and the grouped delete only, never any amount sync.
    /// Non-financial UUID — never encrypted. `nil` for ordinary lines. Assigned
    /// server-side by `POST /budget-lines/savings-withdrawal`.
    var savingsWithdrawalGroupId: UUID?

    /// Savings goal this INCOME forecast announces a withdrawal from (PUL-329 v2).
    /// Both stay optional so a payload served before the feature is deployed still
    /// decodes. The name is a snapshot: it survives the goal, and outlives the id
    /// when the goal is deleted.
    ///
    /// Not to be confused with `savingsGoalId`, which is the opposite direction —
    /// a SAVING forecast paying INTO a goal.
    var sourceSavingsGoalId: String?
    var sourceSavingsGoalName: String?

    // Currency conversion metadata
    var originalAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
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

    /// `true` when this line is one occurrence of a "Lisser" expense (PUL-17),
    /// i.e. it carries a `spreadGroupId`. Read by the projector / detail page to
    /// surface the "Lissé" indicator — never recomputed inline in a view body.
    var isSpread: Bool {
        spreadGroupId != nil
    }

    /// `true` when this INCOME line is the "pris sur ton épargne" half of a
    /// savings-withdrawal couple (PUL-292) — drives the muted badge on the row.
    /// The paired saving line ("Remettre sur ton épargne") lives in M+1 and is
    /// an ordinary saving otherwise.
    var isSavingsWithdrawalIncome: Bool {
        kind == .income && savingsWithdrawalGroupId != nil
    }

    var isVirtualRollover: Bool {
        isRollover == true
    }

    /// The savings goal this income forecast draws from, active or broken
    /// (PUL-329 v2), or `nil` when the money is planned to come from elsewhere.
    var savingsGoalSource: SavingsGoalSource? {
        SavingsGoalSource(goalId: sourceSavingsGoalId, name: sourceSavingsGoalName)
    }

    /// An announced withdrawal is realized by creating the real income, not by
    /// pointing the forecast. A broken source (goal deleted) can no longer be
    /// realized and falls back to an ordinary forecast — the server refuses to
    /// debit a goal that is gone.
    var isPlannedSavingsWithdrawal: Bool {
        sourceSavingsGoalId != nil
    }

    /// PUL-22 (CA1/CA6/CA7) — whether "Reporter au mois suivant" may be offered:
    /// an unchecked, one-off line that isn't the virtual rollover, isn't a spread
    /// occurrence (PUL-17 — moving one slice breaks the group's month distribution),
    /// isn't half of a savings-withdrawal couple (PUL-292 — moving one side breaks
    /// the M/M+1 derivations: badge, origin subtitle, choice-alert months), and
    /// carries no allocated transactions. The caller supplies the allocation flag
    /// (the line itself doesn't hold its transactions); CA5 (next-month budget
    /// exists) is a screen-wide check applied separately in the view.
    func isPostponeEligible(hasAllocatedTransactions: Bool) -> Bool {
        !isChecked
            && recurrence == .oneOff
            && !isVirtualRollover
            && !isSpread
            && savingsWithdrawalGroupId == nil
            && !hasAllocatedTransactions
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
            tagIds: tagIds,
            spreadGroupId: spreadGroupId,
            savingsWithdrawalGroupId: savingsWithdrawalGroupId,
            sourceSavingsGoalId: sourceSavingsGoalId,
            sourceSavingsGoalName: sourceSavingsGoalName,
            originalAmount: originalAmount,
            originalCurrency: originalCurrency,
            targetCurrency: targetCurrency,
            exchangeRate: exchangeRate,
            isRollover: isRollover,
            rolloverSourceBudgetId: rolloverSourceBudgetId
        )
    }
}

// MARK: - Savings Withdrawal (PUL-292)

extension BudgetLine {
    /// Origin month (1-12) of a savings-withdrawal repayment: the paired saving
    /// ("Remettre sur ton épargne") sits on M+1, so the money was drawn in
    /// M = its budget month − 1, wrapping January → December (PUL-292). Pure
    /// arithmetic — a line doesn't carry its own month, so the caller supplies
    /// the saving line's budget month.
    static func savingsWithdrawalOriginMonth(forBudgetMonth month: Int) -> Int {
        month == 1 ? 12 : month - 1
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
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?
    let tagIds: [String]?
    /// Only ever set at creation (PUL-329 v2). The origin is immutable
    /// afterwards, so `BudgetLineUpdate` deliberately has no counterpart —
    /// the same asymmetry `TransactionCreate` already carries.
    let sourceSavingsGoalId: String?

    init(
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        templateLineId: String? = nil,
        savingsGoalId: String? = nil,
        sourceSavingsGoalId: String? = nil,
        isManuallyAdjusted: Bool = false,
        checkedAt: Date? = nil,
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil,
        tagIds: [String]? = nil
    ) {
        self.budgetId = budgetId
        self.templateLineId = templateLineId
        self.savingsGoalId = savingsGoalId
        self.sourceSavingsGoalId = sourceSavingsGoalId
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
        self.tagIds = tagIds
    }
}

struct BudgetLineUpdate: Encodable {
    let id: String
    var name: String?
    var amount: Decimal?
    var kind: TransactionKind?
    var isManuallyAdjusted: Bool?
    /// Tri-state savings-goal link: `.none` omits the key (no change),
    /// `.some(nil)` sends explicit `null` (untag), `.some(id)` sets the link.
    /// Only the saving-line editor sets this — every other PATCH leaves the
    /// tag untouched.
    var savingsGoalId: String??
    var originalAmount: Decimal?
    var originalCurrency: SupportedCurrency?
    var targetCurrency: SupportedCurrency?
    var exchangeRate: Decimal?
    var tagIds: [String]?
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
