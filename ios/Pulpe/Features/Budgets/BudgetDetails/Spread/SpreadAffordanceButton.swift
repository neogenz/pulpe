import SwiftUI

/// PUL-17 — the "Prévision lissée → voir les mois" affordance. Shared by
/// the budget-line detail page AND the transaction detail page so both surfaces
/// of a spread line reach the occurrences timeline in lockstep. The caller
/// provides the action (it owns the router + the spread group id).
struct SpreadAffordanceButton: View {
    let kind: TransactionKind
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "calendar")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(kind.color)

                Text(Self.title(for: kind))
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel("\(Self.title(for: kind)), voir les mois")
    }

    static func title(for kind: TransactionKind) -> String {
        "\(kind.label) lissée"
    }
}
