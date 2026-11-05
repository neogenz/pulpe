import SwiftUI

/// Multi-line monospace field for a recovery key, with a live character counter.
struct RecoveryKeyInputField: View {
    @Binding var text: String
    var isFocused: FocusState<Bool>.Binding
    /// `false` when the caller shows its own count and caption.
    var showsCounter = true

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            TextField("XXXX-XXXX-XXXX-XXXX-...", text: $text, axis: .vertical)
                .font(.system(.body, design: .monospaced))
                .kerning(1)
                .lineLimit(3...5)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .textContentType(.oneTimeCode)
                .privacySensitive()
                .focused(isFocused)
                .foregroundStyle(Color.textPrimary)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.outline, lineWidth: DesignTokens.BorderWidth.thin)
                }
            if showsCounter {
                Text("\(count) caractères sur \(RecoveryKeyFormatter.strippedKeyCharacterCount). Tirets facultatifs.")
                    .font(PulpeTypography.footnote)
                    .monospacedDigit()
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }

    var count: Int { RecoveryKeyFormatter.strip(text).count }
}
