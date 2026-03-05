import SwiftUI

/// Inline status row for password match / mismatch feedback.
struct PasswordMatchRow: View {
    let matches: Bool

    private var icon: String { matches ? "checkmark.circle.fill" : "xmark.circle.fill" }
    private var text: String {
        matches ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"
    }
    private var color: Color { matches ? .financialSavings : .errorPrimary }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(PulpeTypography.caption)
                .foregroundStyle(color)
                .accessibilityHidden(true)
            Text(text)
                .font(PulpeTypography.caption)
                .foregroundStyle(color)
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(matches ? "validé" : "non validé")
        .padding(.top, DesignTokens.Spacing.xs)
    }
}
