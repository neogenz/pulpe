import Foundation

/// Pure helpers for the add-allocated-transaction flow. Lives in an `enum`
/// namespace so the page form can stay focused on layout / state, and unit
/// tests can exercise validation / shape logic without bootstrapping SwiftUI.
enum AddAllocatedTransactionLogic {
    /// Bundle of form inputs for `buildCreate`. Grouping the args avoids a
    /// 6-parameter signature on the call site (and the matching SwiftLint
    /// rule), and makes it cheap to add an input later without rippling
    /// through every call site.
    struct FormInput {
        let name: String
        let amount: Decimal
        let transactionDate: Date
        let isChecked: Bool
        let conversion: CurrencyConversion?
    }

    static func isFormValid(name: String, amount: Decimal?, isLoading: Bool) -> Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    /// Whether the user has started typing — used to gate the validation hint
    /// so it doesn't flash on the first frame.
    static func hasStartedFilling(name: String, amount: Decimal?) -> Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Inline hint surfaced under the submit button when the form is invalid
    /// but the user has begun filling. Returns `nil` when the form is valid,
    /// loading, or pristine.
    static func validationHint(
        canSubmit: Bool,
        isLoading: Bool,
        hasStartedFilling: Bool,
        amount: Decimal?,
        name: String
    ) -> String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
        return nil
    }

    /// Builds the API payload for the create call. When `input.conversion` is
    /// non-nil (foreign currency entry) the converted amount + the FX metadata
    /// are sent alongside the original input. Kind is always inherited from
    /// the parent `BudgetLine` so allocated transactions stay aligned with
    /// their envelope.
    static func buildCreate(for line: BudgetLine, input: FormInput) -> TransactionCreate {
        TransactionCreate(
            budgetId: line.budgetId,
            name: input.name,
            amount: input.conversion?.convertedAmount ?? input.amount,
            kind: line.kind,
            budgetLineId: line.id,
            transactionDate: input.transactionDate,
            checkedAt: input.isChecked ? Date() : nil,
            originalAmount: input.conversion?.originalAmount,
            originalCurrency: input.conversion?.originalCurrency,
            targetCurrency: input.conversion?.targetCurrency,
            exchangeRate: input.conversion?.exchangeRate
        )
    }
}
