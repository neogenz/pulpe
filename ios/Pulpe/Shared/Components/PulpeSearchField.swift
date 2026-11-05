import SwiftUI

/// Inline search field (V2 `.search`): a white capsule with a magnifier, always on screen
/// under the page title, unlike `.searchable` which hides in the navigation bar.
struct PulpeSearchField: View {
    let prompt: LocalizedStringKey
    @Binding var text: String

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.textTertiary)
                .accessibilityHidden(true)
            TextField(prompt, text: $text)
                .font(PulpeTypography.bodyLarge)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.textTertiary)
                }
                .iconButtonStyle()
                .accessibilityLabel(AppLocale.string("Effacer"))
            }
        }
        .padding(.horizontal, DesignTokens.ChipMetrics.Standard.horizontalPadding)
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .background(Color.surface, in: .capsule)
        .overlay { Capsule().strokeBorder(Color.outline, lineWidth: DesignTokens.BorderWidth.thin) }
    }
}
