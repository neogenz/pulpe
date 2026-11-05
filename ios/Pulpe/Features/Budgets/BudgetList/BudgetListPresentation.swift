import Foundation

/// The words and groupings of the yearly view and its two creation sheets, kept out of
/// the views so they can be tested.
enum BudgetListPresentation {
    /// A year's months as they are lived: the one in progress, the ones ahead, the closed
    /// ones newest first.
    struct Sections: Equatable {
        var current: [BudgetSparse] = []
        var upcoming: [BudgetSparse] = []
        var closed: [BudgetSparse] = []
    }

    static func sections(of budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> Sections {
        let currentIndex = BudgetPeriodCalculator.periodIndex(currentPeriod)
        var sections = Sections()
        for budget in budgets {
            guard let month = budget.month, let year = budget.year else { continue }
            let index = BudgetPeriodCalculator.periodIndex(BudgetPeriod(month: month, year: year))
            if index == currentIndex {
                sections.current.append(budget)
            } else if index > currentIndex {
                sections.upcoming.append(budget)
            } else {
                sections.closed.append(budget)
            }
        }
        sections.upcoming.sort { ($0.month ?? 0) < ($1.month ?? 0) }
        sections.closed.sort { ($0.month ?? 0) > ($1.month ?? 0) }
        return sections
    }

    /// « Chaque mois va du 25 au 24, ton jour de paie », only when the months do not follow
    /// the calendar.
    static func payDaySubtitle(payDayOfMonth: Int?) -> String? {
        guard let payDay = payDayOfMonth, payDay > 1 else { return nil }
        return AppLocale.string("Chaque mois va du \(payDay) au \(payDay - 1), ton jour de paie")
    }

    static func recapEyebrow(year: Int, isPastYear: Bool) -> String {
        isPastYear
            ? AppLocale.string("Bilan \(String(year))")
            : AppLocale.string("Solde fin d'année \(String(year))")
    }

    /// What the year-end figure rests on, then how many months have their budget.
    static func recapSentence(year: Int, budgetCount: Int, isPastYear: Bool) -> String {
        if budgetCount == 0 {
            return AppLocale.string("Aucun mois budgétisé. Commence dès maintenant.")
        }
        let coverage = budgetCount >= 12
            ? AppLocale.string("Les 12 mois de \(String(year)) ont leur budget.")
            : AppLocale.string("\(budgetCount) mois sur 12 ont leur budget.")
        guard !isPastYear else { return coverage }
        return AppLocale.string("Estimé fin décembre, si la suite de l'année suit le plan.") + " " + coverage
    }

    /// The share of the month's money already planned out, as the budget page's hero
    /// measures it: expenses against income plus what came over from the month before.
    static func usage(of budget: BudgetSparse) -> Double {
        let available = (budget.totalIncome ?? 0) + (budget.rollover ?? 0)
        guard available > 0 else { return 0 }
        return Double(truncating: ((budget.totalExpenses ?? 0) / available) as NSDecimalNumber)
    }

    static func usageLabel(_ usage: Double) -> String {
        let percent = Int((max(usage, 0) * 100).rounded())
        return AppLocale.string("\(percent) % engagé")
    }

    /// « Par défaut · 11 lignes »: the default flag or the description, then the line count.
    static func templateSubtitle(_ template: BudgetTemplate, lineCount: Int?) -> String? {
        let description = template.description?.trimmingCharacters(in: .whitespacesAndNewlines)
        let lead = template.isDefaultTemplate
            ? AppLocale.string("Par défaut")
            : (description?.isEmpty == false ? description : nil)
        let count = lineCount.map { AppLocale.string("\($0) lignes") }
        let parts = [lead, count].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The month as the V2 boards set it, in a row value or a sentence alike: « novembre 2027 ».
    static func monthYear(_ period: BudgetPeriod) -> String {
        "\(Formatters.monthNameInText(for: period.month)) \(period.year)"
    }
}
