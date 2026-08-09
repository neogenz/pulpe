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
        Toggle("Déjà pointé", isOn: $isOn)
            .font(PulpeTypography.bodyLarge)
            .tint(tintColor)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .accessibilityValue(isOn ? "Pointé" : "À pointer")
    }
}
