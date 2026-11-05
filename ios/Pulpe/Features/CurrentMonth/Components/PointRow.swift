import SwiftUI

/// A row waiting to be pointed: the circle points it, the rest of the row opens it. Shared by
/// « À pointer » and the suggestions of the home « À faire » card, so both read the same.
struct PointRow: View {
    let id: String
    let title: String
    let subtitle: String
    var isOverrun = false
    let amount: String
    let isPointed: Bool
    let isSyncing: Bool
    /// Where the circle's 44pt column starts and how far the text sits from it, so a card can
    /// line both up with the discs and titles of its other rows.
    var leadingInset = DesignTokens.Spacing.xs
    var textGap = DesignTokens.Spacing.xs
    let onToggle: () -> Void
    let onOpen: () -> Void

    var body: some View {
        HStack(spacing: textGap) {
            PointCircle(isPointed: isPointed, isSyncing: isSyncing, onToggle: onToggle)
                .accessibilityIdentifier("toPointCircle-\(id)")
            Button(action: onOpen) {
                PulpeListRow(
                    title: title,
                    subtitle: subtitle,
                    subtitleTint: isOverrun ? .financialOverBudget : .textSecondary,
                    trailing: { Text(amount).sensitiveAmount() }
                )
            }
            .plainPressedButtonStyle()
            // On the open button, not the row: there it would overwrite the point circle's id.
            .accessibilityIdentifier("toPointRow-\(id)")
        }
        .padding(.leading, leadingInset)
        .padding(.trailing, DesignTokens.Spacing.lg)
    }
}
