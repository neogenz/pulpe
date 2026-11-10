import Foundation

/// A concrete `{year, month}` target inside a spread window (PUL-17).
/// Identifiable by its sortable ordinal so the grid keeps stable identity.
struct SpreadMonth: Identifiable, Hashable, Sendable {
    let year: Int
    let month: Int

    /// Months since year 0 — a total order used for sorting and range maths.
    var ordinal: Int { year * 12 + (month - 1) }

    var id: Int { ordinal }

    /// Capitalized month name, e.g. "Janvier".
    var name: String { Formatters.monthName(for: month) }

    /// "Janvier 2026" — used in the De/À picker rows.
    var longName: String { "\(name) \(year)" }

    /// "nov. 26" — a month tile's label.
    var shortLabel: String { "\(Formatters.shortMonthName(for: month)) \(String(format: "%02d", year % 100))" }

    static func from(ordinal: Int) -> SpreadMonth {
        SpreadMonth(year: ordinal / 12, month: ordinal % 12 + 1)
    }

    /// Every month from `start` through `end` inclusive, ascending.
    /// Empty when `end` precedes `start`.
    static func range(from start: SpreadMonth, to end: SpreadMonth) -> [SpreadMonth] {
        guard end.ordinal >= start.ordinal else { return [] }
        return (start.ordinal...end.ordinal).map(SpreadMonth.from(ordinal:))
    }
}
