import SwiftUI

/// Styled text field for sheet forms with full-area tap target.
///
/// Owns a `@FocusState` and uses `.onTapGesture` so tapping anywhere
/// on the padded background focuses the field — not just the text line.
///
/// When a `label` is provided, renders the standard description field
/// pattern used across all form sheets (label + bordered text field).
///
/// Optionally accepts an external `focusBinding` to let the parent
/// control focus (e.g. for prev/next keyboard navigation).
struct FormTextField: View {
    let hint: String
    @Binding var text: String
    var label: String?
    var accessibilityLabel: String?
    var focusBinding: FocusState<Bool>.Binding?

    @FocusState private var internalFocus: Bool

    private var activeFocus: FocusState<Bool>.Binding {
        focusBinding ?? $internalFocus
    }

    var body: some View {
        if let label {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(label)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)
                textField
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                            .strokeBorder(Color.outlineVariant.opacity(0.5), lineWidth: DesignTokens.BorderWidth.thin)
                    )
                    .accessibilityLabel(accessibilityLabel ?? label)
            }
        } else {
            textField
                .accessibilityLabel(accessibilityLabel ?? hint)
        }
    }

    private var textField: some View {
        TextField(hint, text: $text)
            .font(PulpeTypography.bodyLarge)
            .focused(activeFocus)
            .submitLabel(.done)
            .onSubmit { activeFocus.wrappedValue = false }
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .contentShape(.interaction, Rectangle())
            .onTapGesture { activeFocus.wrappedValue = true }
    }
}
