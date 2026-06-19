import Foundation

/// Pure / injectable helpers for the "Lisser" submit flow (PUL-17, interpretation B).
///
/// Lives in an `enum` namespace so `AddBudgetLineSheet` stays focused on layout +
/// state, and unit tests can exercise the submit wiring (createSpread called with
/// the right tranches, single frozen FX, cross-budget invalidation fired,
/// success-toast copy) without bootstrapping SwiftUI.
enum AddBudgetLineSpreadLogic {
    /// Form inputs for one spread submit. FX is already resolved once upstream
    /// (`conversion`) so every tranche shares the same frozen `exchangeRate`.
    struct SubmitInput {
        let name: String
        let kind: TransactionKind
        let amount: Decimal
        let conversion: CurrencyConversion?
    }

    /// Builds the `POST /budget-lines/spread` body: one tranche per SELECTED
    /// month, the converted per-month amount, and a single frozen `exchangeRate`
    /// + per-tranche `originalAmount` when multi-currency.
    @MainActor
    static func buildCreate(
        calculator: SpreadCalculator,
        input: SubmitInput
    ) -> BudgetLineSpreadCreate {
        let perMonth = input.conversion?.convertedAmount ?? input.amount
        let tranches = calculator.buildTranches(
            amount: perMonth,
            originalAmount: input.conversion?.originalAmount
        )
        return BudgetLineSpreadCreate(
            name: input.name.trimmingCharacters(in: .whitespaces),
            kind: input.kind,
            tranches: tranches,
            originalCurrency: input.conversion?.originalCurrency,
            targetCurrency: input.conversion?.targetCurrency,
            exchangeRate: input.conversion?.exchangeRate
        )
    }

    /// Base toast + conditional suffixes (auto-created budgets / skipped months).
    /// "Dépense lissée sur {n} mois · {b} budget(s) créé(s) · {s} mois ignoré(s) (aucun modèle)".
    static func successMessage(for response: BudgetLineSpreadResponse) -> String {
        var message = "Dépense lissée sur \(response.lines.count) mois"
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
