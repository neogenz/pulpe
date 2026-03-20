import SwiftUI

struct CheckedToggle: View {
    @Binding var isOn: Bool
    let tintColor: Color

    var body: some View {
        Toggle("Pointer", isOn: $isOn)
            .font(PulpeTypography.bodyLarge)
            .tint(tintColor)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .accessibilityLabel("Marquer comme pointé")
            .accessibilityValue(isOn ? "Pointé" : "À pointer")
    }
}
