import SwiftUI

/// Inline status row for password strength criteria (e.g. "8 caractères minimum"):
/// an 18pt green disc with a white check once met, an empty ring until then.
struct PasswordCriteriaRow: View {
    let met: Bool
    let text: String

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(met ? Color.pulpePrimary : Color.textTertiary)
                .accessibilityHidden(true)
            Text(text)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(met ? "validé" : "non validé")
    }
}
