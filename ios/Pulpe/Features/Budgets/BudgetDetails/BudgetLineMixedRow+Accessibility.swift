import SwiftUI

// MARK: - Spoken Label

extension BudgetLineMixedRow {
    /// The row's spoken contract, composed from facts the view has already resolved.
    /// Pure and static like `metadataText`, so the assertion reads it without standing a
    /// view up — the recurrence is a bare glyph on screen, and this is the only place
    /// that says the word out loud.
    static func accessibilityLabel(
        line: BudgetLine,
        status: String,
        amount: String,
        metadata: String?,
        tagNames: [String]
    ) -> String {
        let context = metadata.map { " · \($0)" } ?? ""
        let tags = tagNames.isEmpty
            ? ""
            : " · " + AppLocale.string("Tags : \(tagNames.joined(separator: ", "))")
        return "\(line.kind.label) · \(line.recurrence.label) · \(line.name)\(context) · \(amount) · \(status)\(tags)"
    }
}
