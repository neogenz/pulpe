import Foundation

/// Pure / injectable helpers for the "Lisser" submit flow (PUL-17, interpretation B).
///
/// Lives in an `enum` namespace so `AddBudgetLineSheet` stays focused on layout +
/// state, and unit tests can exercise the submit wiring (createSpread called with
/// the right per-month amount + months, single frozen FX, cross-budget
/// invalidation fired, success-toast copy) without bootstrapping SwiftUI.
enum AddBudgetLineSpreadLogic {
    /// Form inputs for one spread submit. FX is already resolved once upstream
    /// (`conversion`) so a single frozen `exchangeRate` covers every month.
    struct SubmitInput {
        let name: String
        let kind: TransactionKind
        let amount: Decimal
        let conversion: CurrencyConversion?
    }

    /// Builds the `POST /budget-lines/spread` intent: the converted per-month
    /// amount, the SELECTED months, and a single frozen `exchangeRate` +
    /// `perMonthOriginalAmount` when multi-currency. The server replicates the
    /// per-month amount into one tranche per month.
    @MainActor
    static func buildCreate(
        calculator: SpreadCalculator,
        input: SubmitInput
    ) -> BudgetLineSpreadCreate {
        let perMonth = input.conversion?.convertedAmount ?? input.amount
        let months = calculator.selectedMonths.map {
            SpreadMonthRef(year: $0.year, month: $0.month)
        }
        return BudgetLineSpreadCreate(
            name: input.name.trimmingCharacters(in: .whitespaces),
            kind: input.kind,
            perMonthAmount: perMonth,
            months: months,
            originalCurrency: input.conversion?.originalCurrency,
            targetCurrency: input.conversion?.targetCurrency,
            exchangeRate: input.conversion?.exchangeRate,
            perMonthOriginalAmount: input.conversion?.originalAmount
        )
    }

    /// Base toast + conditional suffixes (auto-created budgets / skipped months).
    /// The noun follows the spread's kind — "Épargne lissée" for `.saving`,
    /// "Dépense lissée" otherwise (both feminine, so "lissée" accords either way).
    /// "{Noun} lissée sur {n} mois · {b} budget(s) créé(s) · {s} mois ignoré(s) (aucun modèle)".
    static func successMessage(for response: BudgetLineSpreadResponse) -> String {
        let noun = response.lines.first?.kind == .saving ? "Épargne" : "Dépense"
        var message = "\(noun) lissée sur \(response.lines.count) mois"
        let created = response.createdBudgets.count
        if created > 0 {
            message += " · \(created) budget\(created > 1 ? "s" : "") créé\(created > 1 ? "s" : "")"
        }
        let skipped = response.skippedMonths.count
        if skipped > 0 {
            message += " · \(skipped) mois ignoré\(skipped > 1 ? "s" : "") (aucun modèle)"
        }
        return message
    }
}
