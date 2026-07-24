import SwiftUI

/// PUL-17 — the "Dépense lissée → voir les mois" affordance: a dedicated Button
/// (never a whole detail row) wrapping a tinted PulpeChip + chevron. Shared by
/// the budget-line detail page AND the transaction detail page so both surfaces
/// of a spread expense reach the occurrences timeline in lockstep. The caller
/// provides the action (it owns the router + the spread group id).
///
/// Both pages put this chip on the bare `appBackground`, where `.muted` washes out
/// (1.04:1) — hence the semantic tint. The chevron takes no color of its own so it
/// inherits the chip's ink.
struct SpreadAffordanceButton: View {
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            PulpeChip(
                icon: "calendar",
                label: "Dépense lissée",
                style: .semantic(.financialSavings),
                trailing: {
                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.metricMini)
                }
            )
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel("Voir les mois de la dépense lissée")
    }
}
