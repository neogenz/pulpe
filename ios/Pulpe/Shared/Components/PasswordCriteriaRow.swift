import SwiftUI

/// Inline status row for password strength criteria (e.g. "8 caractères minimum").
struct PasswordCriteriaRow: View {
    let met: Bool
    let text: String

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(PulpeTypography.caption)
                .foregroundStyle(met ? Color.financialSavings : Color.textSecondaryOnboarding.opacity(0.5))
                .accessibilityHidden(true)
            Text(text)
                .font(PulpeTypography.caption)
                .foregroundStyle(met ? Color.textPrimaryOnboarding : Color.textSecondaryOnboarding)
        }
    }
}
