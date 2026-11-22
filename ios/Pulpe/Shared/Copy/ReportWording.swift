import Foundation

/// How a month's name reads inside a title: « Report d'octobre », « Bilan de mars ».
enum ReportWording {
    /// "Report d'octobre" / "Report de septembre": French elides before a vowel; the other
    /// languages translate both keys the same.
    /// `nil` when the month the report comes from is not known: « Report du mois précédent ».
    static func reportTitle(of month: Int?) -> String {
        guard let month else { return AppLocale.string("Report du mois précédent") }
        let name = Formatters.monthNameInText(for: month)
        return elides(name) ? AppLocale.string("Report d'\(name)") : AppLocale.string("Report de \(name)")
    }

    /// Whether French writes « d' » rather than « de » before this word.
    static func elides(_ word: String) -> Bool {
        guard let first = word.lowercased().first else { return false }
        return "aeiouyàâäéèêëîïôöûüh".contains(first)
    }
}

extension ReportWording {
    /// « Ton disponible de novembre » / « Ton disponible d'avril »: the impact block's title.
    static func availableTitle(of month: Int) -> String {
        let name = Formatters.monthNameInText(for: month)
        return elides(name)
            ? AppLocale.string("Ton disponible d'\(name)")
            : AppLocale.string("Ton disponible de \(name)")
    }
}

extension ReportWording {
    /// The month a report comes from: the last budget before `month`/`year` among `budgets`.
    /// The server carries over from that budget, which is not the calendar month before when
    /// the user skipped one. `nil` when the list does not hold it.
    static func sourceMonth(before month: Int, year: Int, among budgets: [BudgetSparse]) -> Int? {
        budgets
            .compactMap { budget -> (year: Int, month: Int)? in
                guard let budgetMonth = budget.month, let budgetYear = budget.year,
                      (budgetYear, budgetMonth) < (year, month) else { return nil }
                return (budgetYear, budgetMonth)
            }
            .max { $0 < $1 }?
            .month
    }
}
