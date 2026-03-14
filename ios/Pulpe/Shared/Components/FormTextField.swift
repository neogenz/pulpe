import SwiftUI

/// Styled text field for sheet forms with full-area tap target.
///
/// Owns a `@FocusState` and uses `.onTapGesture` so tapping anywhere
/// on the padded background focuses the field — not just the text line.
///
/// When a `label` is provided, renders the standard description field
/// pattern used across all form sheets (label + bordered text field).
struct FormTextField: View {
    let placeholder: String
    @Binding var text: String
    var label: String?
    var accessibilityLabel: String?

    @FocusState private var isFocused: Bool

    var body: some View {
        if let label {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(label)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
                textField
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                            .strokeBorder(Color.outlineVariant.opacity(0.5), lineWidth: 1)
                    )
                    .accessibilityLabel(accessibilityLabel ?? label)
            }
        } else {
            textField
        }
    }

    private var textField: some View {
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
