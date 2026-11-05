import SwiftUI

/// Large title of a root screen, left aligned, with an optional 15pt `ink2` subtitle.
struct PageHeader: View {
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(title)
                .font(PulpeTypography.pageTitle)
                .tracking(DesignTokens.Tracking.pageTitle)
                .foregroundStyle(Color.textPrimary)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle)
                    .font(PulpeTypography.pageSubtitle)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }
}

#Preview {
    PageHeader(title: "Budgets", subtitle: "Tous tes mois, d'un coup d'œil")
        .padding(.vertical)
        .background(Color.appBackground)
}
