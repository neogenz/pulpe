import SwiftUI

/// PUL-17 — the "Prévision lissée → voir les mois" affordance. Shared by
/// the budget-line detail page AND the transaction detail page so both surfaces
/// of a spread line reach the occurrences timeline in lockstep. The caller
/// provides the action (it owns the router + the spread group id).
struct SpreadAffordanceButton: View {
    let kind: TransactionKind
    let onTap: () -> Void

    var body: some View {
        ContextLinkRow(
            icon: "calendar",
            iconTint: kind.color,
            title: Self.title(for: kind),
            accessibilityLabel: "\(Self.title(for: kind)), voir les mois",
            action: onTap
        )
    }

    static func title(for kind: TransactionKind) -> String {
        "\(kind.label) lissée"
    }
}
