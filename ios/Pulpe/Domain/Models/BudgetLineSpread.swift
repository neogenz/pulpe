import Foundation

/// One target month reference for a "Lisser" expense (PUL-17).
/// The client sends the per-month amount + the selected months; the server
/// replicates the amount into one concrete tranche per month before the RPC
/// fan-out (interpretation B — montant/mois répliqué, no division).
struct SpreadMonthRef: Encodable, Sendable {
    let year: Int
    let month: Int
}

/// Which amount the user typed: a per-month figure (server replicates it) or a
/// TOTAL the server divides cents-preservingly over the selected months (PUL-17
/// dual-mode). The raw values are the wire contract — keep 1:1 with the backend.
enum SpreadAmountKind: String, Encodable, Sendable {
    case perMonth
    case total
}

/// Request body for `POST /budget-lines/spread`. `kind` excludes `.income`
/// (revenu lissé hors scope V1). Two amount modes share this body (PUL-17 dual):
/// - `mode == .perMonth`: `perMonthAmount` set, the server replicates it per month;
/// - `mode == .total`: `totalAmount` set, the server divides it cents-preservingly.
/// A single frozen FX trio (figé) covers every month; the `*OriginalAmount` mirror
/// of the active amount is present only in full-FX (multi-currency) spreads.
/// The `spreadGroupId` is generated server-side.
struct BudgetLineSpreadCreate: Encodable, Sendable {
    let name: String
    let kind: TransactionKind
    let mode: SpreadAmountKind
    let months: [SpreadMonthRef]
    let perMonthAmount: Decimal?
    let perMonthOriginalAmount: Decimal?
    let totalAmount: Decimal?
    let totalOriginalAmount: Decimal?
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    init(
        name: String,
        kind: TransactionKind,
        mode: SpreadAmountKind = .perMonth,
        months: [SpreadMonthRef],
        perMonthAmount: Decimal? = nil,
        perMonthOriginalAmount: Decimal? = nil,
        totalAmount: Decimal? = nil,
        totalOriginalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) {
        self.name = name
        self.kind = kind
        self.mode = mode
        self.months = months
        self.perMonthAmount = perMonthAmount
        self.perMonthOriginalAmount = perMonthOriginalAmount
        self.totalAmount = totalAmount
        self.totalOriginalAmount = totalOriginalAmount
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
