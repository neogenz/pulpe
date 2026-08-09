import SwiftUI

struct CheckedToggle: View {
    @Binding var isOn: Bool
    let tintColor: Color

    var body: some View {
        // Les mêmes mots que sur le web. Le contrôle énonce un fait sur
        // l'argent, il ne demande pas une action : « Pointer » se lisait comme
        // un bouton, et disait autre chose que le même contrôle sur la webapp.
        // Le libellé visible sert aussi de nom accessible — un override ici
        // repartirait à la dérive au premier changement de copie.
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Déjà pointé")
                    .font(PulpeTypography.bodyLarge)

                // « Pointé » est un mot du produit, pas du français courant :
                // sans glose, il fallait basculer l'interrupteur pour découvrir
                // ce qu'il changeait. VoiceOver lit cette ligne à la suite du
                // libellé, ce que le web obtient par `aria-describedby`.
                Text("Le montant est déjà passé sur ton compte.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .tint(tintColor)
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        .accessibilityValue(isOn ? "Pointé" : "À pointer")
    }
}
