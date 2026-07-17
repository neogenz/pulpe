import SwiftUI

// MARK: - Savings withdrawal delete choice copy (PUL-292)

/// Copy for the grouped-delete choice alert, split out of the main view file
/// (same precedent as `BudgetDetailsView+Routing.swift`). Describes the two
/// concrete movements — never the concept (« avance »/« emprunt » forbidden).
extension BudgetDetailsView {
    func dispatchDeleteSavingsWithdrawal(_ line: BudgetLine, scope: SavingsWithdrawalDeleteScope) {
        Task { await coordinator.dispatch(.deleteSavingsWithdrawal(line: line, scope: scope, toastContext)) }
    }

    func savingsWithdrawalKeepIncomeLabel(for line: BudgetLine) -> String {
        "Garder le revenu de \(Formatters.monthName(for: savingsWithdrawalIncomeMonth(for: line)))"
    }

    func savingsWithdrawalDeleteMessage(for line: BudgetLine) -> String {
        let currency = userSettingsStore.currency
        let incomeMonth = savingsWithdrawalIncomeMonth(for: line)
        let savingMonth = incomeMonth == 12 ? 1 : incomeMonth + 1
        let plus = line.amount.asSignedCurrency(currency, for: .income)
        let minus = line.amount.asSignedCurrency(currency, for: .saving)
        return "\(plus) sur \(Formatters.monthName(for: incomeMonth)) est lié à "
            + "\(minus) sur \(Formatters.monthName(for: savingMonth))."
    }

    /// Month M carrying the income half. The selected line lives in the open
    /// budget: if it's the income, M is that month; if it's the M+1 repayment
    /// saving, M is its month − 1.
    private func savingsWithdrawalIncomeMonth(for line: BudgetLine) -> Int {
        let openMonth = projector.screenState.hero.month
            ?? Calendar.current.component(.month, from: Date())
        return line.kind == .income
            ? openMonth
            : BudgetLine.savingsWithdrawalOriginMonth(forBudgetMonth: openMonth)
    }
}
