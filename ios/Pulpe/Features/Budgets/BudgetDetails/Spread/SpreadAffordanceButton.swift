import SwiftUI

/// PUL-17 — the "Dépense lissée → voir les mois" affordance: a dedicated Button
/// (never a whole detail row) wrapping a `.muted` PulpeChip + chevron. Shared by
/// the budget-line detail page AND the transaction detail page so both surfaces
/// of a spread expense reach the occurrences timeline in lockstep. The caller
/// provides the action (it owns the router + the spread group id).
struct SpreadAffordanceButton: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            PulpeChip(
                icon: "calendar",
                label: "Dépense lissée",
                style: .muted,
                trailing: {
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.textTertiary)
                }
            )
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel("Voir les mois de la dépense lissée")
    }
}
