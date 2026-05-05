import SwiftUI

/// Styled text field for sheet forms with full-area tap target.
///
/// Owns a `@FocusState` and uses `.onTapGesture` so tapping anywhere
/// on the padded background focuses the field — not just the text line.
///
/// When a `label` is provided, renders the standard description field
/// pattern used across all form sheets (label + bordered text field).
struct FormTextField<Field: Hashable>: View {
    let hint: String
    @Binding var text: String
    var label: String?
    var accessibilityLabel: String?
    var focusBinding: FocusState<Field?>.Binding
    var field: Field

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
            .submitLabel(.done)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .contentShape(.interaction, Rectangle())
            // See type documentation — `Button` would not focus the inner `TextField` with this layout.
            .onTapGesture { focusBinding.wrappedValue = field }
            .focused(focusBinding, equals: field)
            .onSubmit { focusBinding.wrappedValue = nil }
    }
}
