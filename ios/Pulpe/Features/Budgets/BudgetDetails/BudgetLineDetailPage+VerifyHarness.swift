import SwiftUI

#if DEBUG
extension BudgetLineDetailPage {
    /// Visual-only stand-in for the toolbar `Menu`. SwiftUI's `Menu` cannot be
    /// opened programmatically, so the verification harness renders this static
    /// list with the same labels + ordering ("Modifier" / "Supprimer") as
    /// `headerMenu`. Pixel-accurate enough for the screenshot diff in PUL-209
    /// without forking the production view.
    @ViewBuilder
    var debugMenuOverlay: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Modifier")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.lg)
                Image(systemName: "pencil")
                    .foregroundStyle(Color.textPrimary)
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm)

            Divider()

            HStack(spacing: DesignTokens.Spacing.sm) {
                Text("Supprimer")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.destructivePrimary)
                Spacer(minLength: DesignTokens.Spacing.lg)
                Image(systemName: "trash")
                    .foregroundStyle(Color.destructivePrimary)
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .frame(width: 220)
        .pulpeCardBackground()
        .padding(.trailing, DesignTokens.Spacing.md)
        .padding(.top, DesignTokens.Spacing.xxxl)
        .accessibilityHidden(true)
    }
}
#endif
