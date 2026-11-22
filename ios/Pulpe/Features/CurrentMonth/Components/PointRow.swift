import SwiftUI

/// A row waiting to be pointed: the circle points it, the rest of the row opens it. Shared by
/// « À pointer » and the suggestions of the home « À faire » card, so both read the same.
struct PointRow: View {
    let id: String
    let title: String
    let subtitle: String
    var isOverrun = false
    /// The subtitle prints an amount: it leaves the row while amounts are hidden.
    var subtitleHasAmount = false
    let amount: String
    /// An income keeps its `+`: the empty circle no longer tells it from an outflow.
    var isIncome = false
    let isPointed: Bool
    let isSyncing: Bool
    /// Where the circle's 44pt column starts and how far the text sits from it, so a card can
    /// line both up with the discs and titles of its other rows.
    var leadingInset = DesignTokens.Spacing.xs
    var textGap = DesignTokens.Spacing.xs
    @Environment(\.amountsHidden) var amountsHidden
    let onToggle: () -> Void
    let onOpen: () -> Void

    var body: some View {
        HStack(spacing: textGap) {
            PointCircle(isPointed: isPointed, isSyncing: isSyncing, onToggle: onToggle)
                .accessibilityIdentifier("toPointCircle-\(id)")
            Button(action: onOpen) {
                PulpeListRow(
                    title: title,
                    subtitle: amountsHidden && subtitleHasAmount ? nil : subtitle,
                    subtitleTint: isOverrun ? .financialOverBudget : .textSecondary,
                    trailing: { Text(Self.amountText(amount, isIncome: isIncome)).sensitiveAmount() }
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

extension PointRow {
    /// The circle is the same for both natures: only the `+` tells a refund from the purchase.
    static func amountText(_ amount: String, isIncome: Bool) -> String {
        isIncome ? "+\(amount)" : amount
    }
}
