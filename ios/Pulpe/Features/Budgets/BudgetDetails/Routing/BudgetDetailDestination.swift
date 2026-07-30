import Foundation

/// Identifiable wrapper around a previous-budget id, used as the payload of
/// `BudgetDetailDestination.previousBudget`.
struct PreviousBudgetItem: Identifiable {
    let id: String
}

/// Source of a total-preserving "lisser un existant" (PUL-17 v1.1): an existing
/// prévision (`budgetLine`) or a free `transaction`, with its locked total and
/// anchor month (M0). `kind` (expense/saving) drives the sheet's accent color.
struct SpreadExistingSource: Identifiable, Hashable, Sendable {
    enum SourceType: Hashable, Sendable { case budgetLine, transaction }

    let id: String
    let sourceType: SourceType
    let kind: TransactionKind
    let name: String
    let total: Decimal
    let month: Int
    let year: Int
}

/// Prefill + anchor for the "piocher dans son épargne" sheet (PUL-292). Carries
/// the viewed month M (the couple's income lands here; the repayment saving in
/// M+1) plus an optional pre-filled amount / source. `startsAtPreview` skips the
/// amount step — used when the AddBudgetLineSheet income toggle routes straight
/// to the preview with the amount + name already typed. `id` is fresh per
/// presentation so `.sheet(item:)` rebuilds the sheet (and its minted
/// idempotency key) for each new intent.
struct SavingsWithdrawalPrefill: Identifiable {
    let id = UUID()
    let budgetId: String
    let anchorMonth: Int
    let anchorYear: Int
    /// Pre-typed amount (toggle path). The amount field itself stays empty on the
    /// card path — the deficit is offered via `missingAmount`, not imposed (CA3).
    var amount: Decimal?
    /// |available| for the deficit quick-fill chip on step 1 (card path).
    var missingAmount: Decimal?
    /// Currency the pre-typed `amount` was entered in (toggle path). When set, the
    /// sheet seeds its input currency from it instead of the settings default, so
    /// an amount typed in EUR isn't re-anchored to CHF (PUL-292).
    var inputCurrency: SupportedCurrency?
    var source: String?
    var startsAtPreview: Bool = false
}

/// Sheet destinations for `BudgetDetailsView`.
///
/// Single source of truth for sheet presentation. Apple's guidance is to
/// drive sheet presentation from a single `.sheet(item:)` modifier rather
/// than stacking multiple `.sheet(...)` siblings — chained presentations
/// only animate cleanly when the system owns the transition.
enum BudgetDetailDestination: Identifiable {
    case addBudgetLine
    case editBudgetLine(BudgetLine)
    case previousBudget(PreviousBudgetItem)
    case realizedBalance
    /// Read-only timeline of every month a "Lisser" outflow touches (PUL-17 Lot C).
    case spreadOccurrences(spreadGroupId: String, kind: TransactionKind)
    /// Total-preserving "lisser un existant" config sheet (PUL-17 v1.1).
    case spreadExisting(SpreadExistingSource)
    /// "Piocher dans son épargne" sheet (PUL-292) — amount → 2-month preview.
    case savingsWithdrawal(SavingsWithdrawalPrefill)

    var id: String {
        switch self {
        case .addBudgetLine: "addBudgetLine"
        case .editBudgetLine(let line): "editBudgetLine-\(line.id)"
        case .previousBudget(let item): "previousBudget-\(item.id)"
        case .realizedBalance: "realizedBalance"
        case .spreadOccurrences(let groupId, _): "spreadOccurrences-\(groupId)"
        case .spreadExisting(let source): "spreadExisting-\(source.id)"
        case .savingsWithdrawal(let prefill): "savingsWithdrawal-\(prefill.id)"
        }
    }
}
