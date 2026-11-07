import SwiftUI

/// Last row of a budget section: creates a prévision in that section (V2 `row.add`).
/// 52pt, green 15pt semibold text, a 28pt `accentWash` disc with a plus.
struct SectionAddRow: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: "plus")
                    .font(.system(size: DesignTokens.Checkbox.glyphSize, weight: .bold))
                    .foregroundStyle(Color.pulpePrimary)
                    .frame(width: DesignTokens.Control.addRowDisc, height: DesignTokens.Control.addRowDisc)
                    .background(Color.accentWash, in: Circle())
                    .accessibilityHidden(true)
                Text(title)
                    .font(PulpeTypography.chipLabel)
                    .foregroundStyle(Color.pulpePrimary)
                Spacer(minLength: DesignTokens.Spacing.none)
            }
            .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    SectionAddRow(title: "Ajouter une prévision") {}
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
        .padding()
        .background(Color.appBackground)
}
