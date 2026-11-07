import Foundation

extension BudgetTemplate {
    /// What sets the model apart in a row or a header: « Par défaut », else its description.
    var distinguishingText: String? {
        if isDefaultTemplate { return AppLocale.string("Par défaut") }
        let trimmed = description?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == false ? trimmed : nil
    }

    /// « Par défaut · 11 lignes », « Juillet et août · 12 lignes »; `nil` when there is neither.
    func subtitle(lineCount: Int?) -> String? {
        let count = lineCount.map { AppLocale.string("\($0) lignes") }
        let parts = [distinguishingText, count].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
