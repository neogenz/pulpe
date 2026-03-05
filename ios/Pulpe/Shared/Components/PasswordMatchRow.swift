import SwiftUI

/// Inline status row for password match / mismatch feedback.
struct PasswordMatchRow: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.footnote)
                .foregroundStyle(color)
                .accessibilityHidden(true)
            Text(text)
                .font(PulpeTypography.caption)
                .foregroundStyle(color)
        }
        .padding(.top, DesignTokens.Spacing.xs)
    }
}
