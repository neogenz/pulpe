import Foundation

/// One target month reference for a "Lisser" expense (PUL-17).
/// The client sends the per-month amount + the selected months; the server
/// replicates the amount into one concrete tranche per month before the RPC
/// fan-out (interpretation B — montant/mois répliqué, no division).
struct SpreadMonthRef: Encodable, Sendable {
    let year: Int
    let month: Int
}

/// Request body for `POST /budget-lines/spread`. `kind` excludes `.income`
/// (revenu lissé hors scope V1). The client sends a single `perMonthAmount`
/// plus the selected `months`; the server builds tranches by replicating that
/// amount per month. A single frozen FX trio (figé) covers every month;
/// `perMonthOriginalAmount` is present only in full-FX (multi-currency) spreads.
/// The `spreadGroupId` is generated server-side.
struct BudgetLineSpreadCreate: Encodable, Sendable {
    let name: String
    let kind: TransactionKind
    let perMonthAmount: Decimal
    let months: [SpreadMonthRef]
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?
    let perMonthOriginalAmount: Decimal?

    init(
        name: String,
        kind: TransactionKind,
        perMonthAmount: Decimal,
        months: [SpreadMonthRef],
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil,
        perMonthOriginalAmount: Decimal? = nil
    ) {
        self.name = name
        self.kind = kind
        self.perMonthAmount = perMonthAmount
        self.months = months
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
        self.perMonthOriginalAmount = perMonthOriginalAmount
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
