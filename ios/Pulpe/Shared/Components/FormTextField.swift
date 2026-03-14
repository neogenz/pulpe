import SwiftUI

/// Styled text field for sheet forms with full-area tap target.
///
/// Owns a `@FocusState` and uses `.onTapGesture` so tapping anywhere
/// on the padded background focuses the field — not just the text line.
struct FormTextField: View {
    let placeholder: String
    @Binding var text: String

    @FocusState private var isFocused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .font(PulpeTypography.bodyLarge)
            .focused($isFocused)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .contentShape(.interaction, Rectangle())
            .onTapGesture { isFocused = true }
    }
}
