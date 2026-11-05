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
    var textContentType: UITextContentType?
    /// `.row`: title on the left, bare field on the right, for one line of a `FormCard`.
    var style: FormRowStyle = .standalone
    /// Runs on the keyboard's Return after the field drops focus: the form's own submit,
    /// so a valid entry is created without reaching for the button under the keyboard.
    var onSubmit: (() -> Void)?

    var body: some View {
        if style == .row, let label {
            HStack(spacing: DesignTokens.Spacing.md) {
                Text(label)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                TextField(hint, text: $text)
                    .font(PulpeTypography.bodyLarge)
                    .multilineTextAlignment(.trailing)
                    .submitLabel(.done)
                    .focused(focusBinding, equals: field)
                    .textContentType(textContentType)
                    .onSubmit {
                        focusBinding.wrappedValue = nil
                        onSubmit?()
                    }
                    .accessibilityLabel(accessibilityLabel ?? label)
            }
            .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            .contentShape(.interaction, Rectangle())
            .onTapGesture { focusBinding.wrappedValue = field }
        } else if let label {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(label)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .padding(.leading, DesignTokens.Spacing.xs)
                textField
                    .accessibilityLabel(accessibilityLabel ?? label)
            }
        } else {
            textField
                .accessibilityLabel(accessibilityLabel ?? hint)
        }
    }

    /// V2 input: white, 14pt radius, 1pt `outline` border, 2pt accent border while focused.
    private var textField: some View {
        let isFocused = focusBinding.wrappedValue == field
        return TextField(hint, text: $text)
            .font(PulpeTypography.bodyLarge)
            .submitLabel(.done)
            .padding(.horizontal, DesignTokens.CornerRadius.input)
            .frame(minHeight: DesignTokens.FrameHeight.input)
            .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.input))
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                    .strokeBorder(
                        isFocused ? Color.pulpePrimary : Color.outline,
                        lineWidth: isFocused ? DesignTokens.Control.inputFocusBorder : DesignTokens.BorderWidth.thin
                    )
            }
            .contentShape(.interaction, Rectangle())
            // See type documentation — `Button` would not focus the inner `TextField` with this layout.
            .onTapGesture { focusBinding.wrappedValue = field }
            .focused(focusBinding, equals: field)
            .textContentType(textContentType)
            .onSubmit {
                focusBinding.wrappedValue = nil
                onSubmit?()
            }
    }
}
