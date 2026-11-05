import Foundation

/// How a month's name reads inside a title: « Report d'octobre », « Bilan de mars ».
enum ReportWording {
    /// "Report d'octobre" / "Report de septembre": French elides before a vowel; the other
    /// languages translate both keys the same.
    static func reportTitle(of month: Int) -> String {
        let name = Formatters.monthNameInText(for: month)
        return elides(name) ? AppLocale.string("Report d'\(name)") : AppLocale.string("Report de \(name)")
    }

    /// Whether French writes « d' » rather than « de » before this word.
    static func elides(_ word: String) -> Bool {
        guard let first = word.lowercased().first else { return false }
        return "aeiouyàâäéèêëîïôöûüh".contains(first)
    }
}
