import SwiftUI

/// Grouped container for form and detail rows: one `surface` card, rows stacked with
/// no spacing, a `FormRowDivider` placed by the caller between two rows.
/// Horizontal padding lives on the card so hairlines align with the row text.
struct FormCard<Content: View>: View {
    /// Optional eyebrow above the card, for a block whose rows do not name themselves.
    var title: LocalizedStringKey?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let title {
                Text(title)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            VStack(spacing: 0) {
                content()
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
        }
    }
}

/// Hairline between two rows of a `FormCard`, inset to the row's text edge.
struct FormRowDivider: View {
    var body: some View {
        Divider()
            .overlay(Color.outlineVariant)
    }
}

#Preview {
    FormCard {
        HStack {
            Text("Date")
            Spacer()
            Text("18 août 2026")
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        FormRowDivider()
        HStack {
            Text("Déjà pointé")
            Spacer()
            Toggle("", isOn: .constant(true)).labelsHidden()
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }
    .padding()
    .pulpeBackground()
}
