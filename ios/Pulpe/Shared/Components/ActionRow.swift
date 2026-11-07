import SwiftUI

/// One row of an action card: a title, one fact, a chevron. A destructive row reads in red and
/// drops the chevron's promise of a page; a disabled row greys out and says why in its fact.
struct ActionRow: View {
    let title: String
    let subtitle: String
    var isDestructive = false
    let action: () -> Void

    @Environment(\.isEnabled) private var isEnabled

    private var titleColor: Color {
        guard isEnabled else { return .textTertiary }
        return isDestructive ? .destructivePrimary : .textPrimary
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(titleColor)
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if !isDestructive {
                    RowChevron()
                }
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
        .plainPressedButtonStyle()
        .contentShape(Rectangle())
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.none) {
        ActionRow(title: "Modifier l'objectif", subtitle: "Nom, cible, échéance") {}
        Divider().overlay(Color.outlineVariant)
        ActionRow(title: "Supprimer le modèle", subtitle: "Aucun budget ne l'utilise", isDestructive: true) {}
        Divider().overlay(Color.outlineVariant)
        ActionRow(title: "Supprimer le modèle", subtitle: "Impossible : il a servi à 9 budgets", isDestructive: true) {}
            .disabled(true)
    }
    .padding(.horizontal, DesignTokens.Spacing.lg)
    .pulpeSurfaceCard()
    .padding()
    .background(Color.appBackground)
}
