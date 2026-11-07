import SwiftUI

/// « Pour bien démarrer » (V2): the two gestures of a first month, in place of « À faire ».
/// Add a first expense, then point what has already gone through the account.
struct HomeStartCard: View {
    let uncheckedNames: [String]
    let onAddFirstExpense: () -> Void
    let onPoint: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Pour bien démarrer")
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.textPrimary)
                .accessibilityAddTraits(.isHeader)
                .padding(.horizontal, DesignTokens.Spacing.xs)

            VStack(spacing: DesignTokens.Spacing.none) {
                TodoRow(
                    systemImage: "plus",
                    title: AppLocale.string("Ajoute ta première dépense"),
                    subtitle: AppLocale.string("Un café, un plein, des courses"),
                    action: onAddFirstExpense
                )
                .accessibilityIdentifier("homeStartAddExpense")

                if !uncheckedNames.isEmpty {
                    Divider()
                        .overlay(Color.outlineVariant)
                        .padding(.leading, DesignTokens.ListRow.dividerInset + DesignTokens.Spacing.md)
                    TodoRow(
                        systemImage: "checkmark.circle",
                        title: AppLocale.string("Pointe ce qui est déjà passé"),
                        subtitle: HomeTodoPresentation.startSubtitle(names: uncheckedNames),
                        blursSubtitle: true,
                        action: onPoint
                    )
                    .accessibilityIdentifier("homeStartPoint")
                }
            }
            .pulpeSurfaceCard()
        }
    }
}
