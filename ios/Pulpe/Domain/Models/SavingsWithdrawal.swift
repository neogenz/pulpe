import Foundation

/// Request body for `POST /budget-lines/savings-withdrawal` (PUL-292 —
/// "piocher dans son épargne"). ONE action creates the linked couple: a Revenu
/// `one_off` of `amount` on the viewed month M, and an Épargne `one_off` of the
/// SAME `amount` on M+1 ("Remettre sur ton épargne"). The server derives M+1
/// from the `budgetId` budget and provisions it from the default template.
///
/// Both line NAMES come from the client (the backend has no i18n): `incomeName`
/// is the source the user typed ("Mon épargne", "Impôts"…), `savingName` is the
/// repayment label.
///
/// `groupId` is the client-minted idempotency key (mirror of `spreadGroupId`,
/// PUL-17): one stable uuid v4 per create intent, replayed verbatim on every
/// retry so a double-tap replays the existing couple instead of duplicating it.
/// Lowercased to mirror the web's `crypto.randomUUID()`.
///
/// A single frozen FX quad (RG-009) covers both lines. The triad rule mirrors
/// the schema `superRefine`: either NO FX field, `targetCurrency` alone, or the
/// full quad. `CurrencyConversionService.convert` yields exactly `nil` (no FX)
/// or the full quad, so this struct never emits the target-only shape.
struct SavingsWithdrawalCreate: Encodable, Sendable {
    let budgetId: String
    let amount: Decimal
    let incomeName: String
    let savingName: String
    let groupId: String
    let originalAmount: Decimal?
    let originalCurrency: SupportedCurrency?
    let targetCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    init(
        budgetId: String,
        amount: Decimal,
        incomeName: String,
        savingName: String,
        groupId: String = UUID().uuidString.lowercased(),
        originalAmount: Decimal? = nil,
        originalCurrency: SupportedCurrency? = nil,
        targetCurrency: SupportedCurrency? = nil,
        exchangeRate: Decimal? = nil
    ) {
        self.budgetId = budgetId
        self.amount = amount
        self.incomeName = incomeName
        self.savingName = savingName
        self.groupId = groupId
        self.originalAmount = originalAmount
        self.originalCurrency = originalCurrency
        self.targetCurrency = targetCurrency
        self.exchangeRate = exchangeRate
    }
}

/// Scope of a grouped savings-withdrawal deletion (PUL-292, CA9) —
/// `DELETE /budget-lines/savings-withdrawal/:groupId?scope=`. Mirrors the schema
/// `z.enum(['pair','repayment'])`:
/// - `pair`: delete BOTH lines (« tout annuler »);
/// - `repayment`: delete ONLY the M+1 saving; the income of M keeps its group id
///   (badge stays). Idempotent server-side when the saving is already gone.
enum SavingsWithdrawalDeleteScope: String, Sendable {
    case pair
    case repayment

    /// Success toast — describes the concrete outcome, never the concept.
    var successToast: String {
        switch self {
        case .pair: AppLocale.string("Les deux prévisions ont été supprimées")
        case .repayment: AppLocale.string("Épargne de remboursement supprimée")
        }
    }
}

/// Response of the couple: the two created lines (Revenu M, Épargne M+1) and the
/// M+1 budget auto-created from the default template (`nil` when it already
/// existed). Pair-shaped — the client never guesses which line is the income.
/// Mirrors the inner `data` object of `budgetLineSavingsWithdrawalResponseSchema`
/// (the `APIClient` unwraps the `{ success, data }` envelope).
struct SavingsWithdrawalResponse: Decodable, Sendable {
    let groupId: UUID
    let incomeLine: BudgetLine
    let savingLine: BudgetLine
    let createdBudget: Budget?
}

/// "Couvrir ce mois avec mon épargne" asked from outside the budget page — the
/// accueil's add sheet with « À remettre » picked. Plain values so the asking
/// feature never names the budget feature's sheet; the app shell turns it into
/// a push of that month's budget page with the withdrawal preview on top.
struct SavingsWithdrawalRequest: Equatable, Sendable {
    let budgetId: String
    let month: Int
    let year: Int
    let amount: Decimal
    let inputCurrency: SupportedCurrency
    let source: String?
    /// |available| when the month runs a deficit, for the quick-fill chip.
    let missingAmount: Decimal?
}

extension SavingsWithdrawalRequest {
    /// `remaining` is the month's « Disponible à dépenser »: below zero, its gap
    /// feeds the quick-fill chip.
    init(budget: Budget, amount: Decimal, inputCurrency: SupportedCurrency, source: String?, remaining: Decimal) {
        self.init(
            budgetId: budget.id,
            month: budget.month,
            year: budget.year,
            amount: amount,
            inputCurrency: inputCurrency,
            source: source,
            missingAmount: remaining.rounded(2) < 0 ? remaining.absoluteValue : nil
        )
    }
}
