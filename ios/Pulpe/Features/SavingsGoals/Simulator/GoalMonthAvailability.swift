import Foundation

/// « Ton disponible de <mois> » on the goal sheets (V2 impact card): the month's own budget when
/// it exists, else the default template's balance, the budget that month would be created from.
struct GoalMonthAvailability: Equatable {
    var budgets: [BudgetSparse] = []
    var templateBalance: Decimal?

    func available(month: Int, year: Int) -> Decimal? {
        budget(month: month, year: year)?.remaining ?? templateBalance
    }

    func hasBudget(month: Int, year: Int) -> Bool {
        budget(month: month, year: year) != nil
    }

    private func budget(month: Int, year: Int) -> BudgetSparse? {
        budgets.first { $0.month == month && $0.year == year }
    }

    static func title(month: Int) -> String {
        AppLocale.string("Ton disponible de \(Formatters.monthNameInText(for: month))")
    }

    /// ponytail: one template fetch per sheet opening; move it to a store if more sheets need it.
    static func loadTemplateBalance() async -> Decimal? {
        guard let template = try? await TemplateService.shared.getDefaultTemplate(),
              let lines = try? await TemplateService.shared.getTemplateLines(templateId: template.id)
        else { return nil }
        return BudgetFormulas.calculateTemplateTotals(lines: lines).balance
    }
}
