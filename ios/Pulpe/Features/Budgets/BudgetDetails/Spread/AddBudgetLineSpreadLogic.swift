import Foundation

/// Pure / injectable helpers for the "Lisser" submit flow (PUL-17, interpretation B).
///
/// Lives in an `enum` namespace so `AddBudgetLineSheet` stays focused on layout +
/// state, and unit tests can exercise the submit wiring (createSpread called with
/// the right per-month amount + months, single frozen FX, cross-budget
/// invalidation fired, success-toast copy) without bootstrapping SwiftUI.
enum AddBudgetLineSpreadLogic {
    static func ctaTitle(for kind: TransactionKind) -> String {
        kind == .saving ? AppLocale.string("Lisser l’épargne") : AppLocale.string("Lisser la dépense")
    }

    /// Form inputs for one spread submit. FX is already resolved once upstream
    /// (`conversion`) so a single frozen `exchangeRate` covers every month. `mode`
    /// decides whether `amount` is read as a per-month figure or the TOTAL.
    /// `spreadGroupId` is the idempotency key minted ONCE by the sheet per create
    /// intent (`@State`) — required (no default) so the retry-driving view must
    /// pass its stable id, never mint a fresh one per attempt.
    struct SubmitInput {
        let name: String
        let kind: TransactionKind
        let amount: Decimal
        let mode: SpreadAmountMode
        let conversion: CurrencyConversion?
        let spreadGroupId: String
        let savingsGoalId: String?

        init(
            name: String,
            kind: TransactionKind,
            amount: Decimal,
            mode: SpreadAmountMode,
            conversion: CurrencyConversion?,
            spreadGroupId: String,
            savingsGoalId: String? = nil
        ) {
            self.name = name
            self.kind = kind
            self.amount = amount
            self.mode = mode
            self.conversion = conversion
            self.spreadGroupId = spreadGroupId
            self.savingsGoalId = savingsGoalId
        }
    }

    /// Builds the `POST /budget-lines/spread` intent: the converted amount, the
    /// SELECTED months, and a single frozen `exchangeRate` + matching
    /// `*OriginalAmount` when multi-currency. In `.total` mode the converted figure
    /// is the TOTAL the server divides cents-preservingly; in `.perMonth` mode it is
    /// the per-month amount the server replicates into one tranche per month.
    @MainActor
    static func buildCreate(
        calculator: SpreadCalculator,
        input: SubmitInput
    ) -> BudgetLineSpreadCreate {
        let convertedAmount = input.conversion?.convertedAmount ?? input.amount
        let originalAmount = input.conversion?.originalAmount
        let months = calculator.selectedMonths.map {
            SpreadMonthRef(year: $0.year, month: $0.month)
        }
        let isTotal = input.mode == .total
        return BudgetLineSpreadCreate(
            name: input.name.trimmingCharacters(in: .whitespaces),
            kind: input.kind,
            savingsGoalId: input.kind.savingsGoalLink(input.savingsGoalId),
            mode: isTotal ? .total : .perMonth,
            months: months,
            perMonthAmount: isTotal ? nil : convertedAmount,
            perMonthOriginalAmount: isTotal ? nil : originalAmount,
            totalAmount: isTotal ? convertedAmount : nil,
            totalOriginalAmount: isTotal ? originalAmount : nil,
            originalCurrency: input.conversion?.originalCurrency,
            targetCurrency: input.conversion?.targetCurrency,
            exchangeRate: input.conversion?.exchangeRate,
            spreadGroupId: input.spreadGroupId
        )
    }

    /// Base toast + conditional suffixes (auto-created budgets / skipped months).
    /// The noun follows the spread's kind — "Épargne lissée" for `.saving`,
    /// "Dépense lissée" otherwise (both feminine, so "lissée" accords either way).
    /// "{Noun} lissée sur {n} mois · {b} budgets créés · {s} mois ignorés (aucun modèle)".
    /// One whole key per segment so no sentence is assembled from translated
    /// fragments; singular/plural variants belong to the string catalog.
    static func successMessage(for response: BudgetLineSpreadResponse) -> String {
        let months = response.lines.count
        var segments = [
            response.lines.first?.kind == .saving
                ? AppLocale.string("Épargne lissée sur \(months) mois")
                : AppLocale.string("Dépense lissée sur \(months) mois"),
        ]
        let created = response.createdBudgets.count
        if created > 0 {
            segments.append(AppLocale.string("\(created) budgets créés"))
        }
        let skipped = response.skippedMonths.count
        if skipped > 0 {
            segments.append(AppLocale.string("\(skipped) mois ignorés (aucun modèle)"))
        }
        return segments.joined(separator: " · ")
    }
}
