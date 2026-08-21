import SwiftUI

// MARK: - Savings withdrawal delete choice copy (PUL-336)

extension BudgetLineDetailPage {
    func dispatchDeleteSavingsWithdrawal(_ line: BudgetLine, scope: SavingsWithdrawalDeleteScope) {
        let context = ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.dispatch(.deleteSavingsWithdrawal(line: line, scope: scope, context)) }
    }

    func savingsWithdrawalRepaymentDeleteLabel(for line: BudgetLine) -> String {
        AppLocale.string("Supprimer \(savingsWithdrawalMonthNames(for: line).saving) seulement")
    }

    func savingsWithdrawalPairDeleteLabel(for line: BudgetLine) -> String {
        let months = savingsWithdrawalMonthNames(for: line)
        return AppLocale.string("Supprimer \(months.income) et \(months.saving)")
    }

    func savingsWithdrawalDeleteMessage(for line: BudgetLine) -> String {
        let months = savingsWithdrawalMonthNames(for: line)
        let amount = line.amount.absoluteValue.asAdaptiveCurrency(userSettingsStore.currency)
        return AppLocale.string(
            "Tu as pris \(amount) sur ton épargne en \(months.income) et prévu de les remettre en \(months.saving)."
        )
    }

    private func savingsWithdrawalMonthNames(for line: BudgetLine) -> (income: String, saving: String) {
        let openMonth = projector.screenState.hero.month
            ?? Calendar.current.component(.month, from: Date())
        let incomeMonth = line.kind == .income
            ? openMonth
            : BudgetLine.savingsWithdrawalOriginMonth(forBudgetMonth: openMonth)
        let savingMonth = incomeMonth == 12 ? 1 : incomeMonth + 1
        let names = (Formatters.monthName(for: incomeMonth), Formatters.monthName(for: savingMonth))

        switch AppLocale.current {
        case .fr, .it:
            return (names.0.lowercased(), names.1.lowercased())
        case .de, .en:
            return names
        }
    }
}
