import Foundation

/// One target month + its amount for a "Lisser" expense (PUL-17).
/// The client computes the amount per month (interpretation B — montant/mois
/// répliqué) and sends concrete tranches; the server inserts them as-is.
/// `originalAmount` is present only in full-FX (multi-currency) spreads.
struct BudgetLineSpreadTranche: Encodable, Sendable {
    let year: Int
    let month: Int
    let amount: Decimal
    let originalAmount: Decimal?

    init(year: Int, month: Int, amount: Decimal, originalAmount: Decimal? = nil) {
        self.year = year
        self.month = month
        self.amount = amount
        self.originalAmount = originalAmount
    }
}

/// Request body for `POST /budget-lines/spread`. `kind` excludes `.income`
/// (revenu lissé hors scope V1). A single frozen `exchangeRate` is shared by
/// every tranche (FX figé). The `spreadGroupId` is generated server-side.
struct BudgetLineSpreadCreate: Encodable, Sendable {
    let name: String
    let kind: TransactionKind
    let tranches: [BudgetLineSpreadTranche]
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    init(
        name: String,
        kind: TransactionKind,
        tranches: [BudgetLineSpreadTranche],
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) {
        self.name = name
        self.kind = kind
        self.tranches = tranches
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
    }
}

/// A month with no default template, skipped during fan-out (no budget created,
/// no line inserted).
struct SpreadSkippedMonth: Decodable, Sendable, Hashable {
    let month: Int
    let year: Int
}

/// Response of the fan-out: the created lines, the budgets auto-created from the
/// user's default template, and the months skipped for lack of a default template.
struct BudgetLineSpreadResponse: Decodable, Sendable {
    let spreadGroupId: UUID
    let lines: [BudgetLine]
    let createdBudgets: [Budget]
    let skippedMonths: [SpreadSkippedMonth]
}
