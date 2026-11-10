import SwiftUI

/// One answer among a few, laid out as a card (V2 `choice`): a title and what it does. The chosen
/// card is washed green with a 2pt green border and a check; the others are white with a hairline.
struct ChoiceCard: View {
    let title: String
    let detail: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text(detail)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(isSelected ? Color.accentInk : Color.textSecondary)
                        .monospacedDigit()
                        .fixedSize(horizontal: false, vertical: true)
                        .sensitiveAmount()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: DesignTokens.Checkbox.glyphSize, weight: .bold))
                        .foregroundStyle(Color.textOnPrimary)
                        .frame(width: DesignTokens.Control.addRowDisc, height: DesignTokens.Control.addRowDisc)
                        .background(Color.pulpePrimary, in: Circle())
                        .accessibilityHidden(true)
                }
            }
            .padding(DesignTokens.Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isSelected ? Color.accentWash : Color.surface, in: cardShape)
            .overlay {
                cardShape.strokeBorder(
                    isSelected ? Color.pulpePrimary : Color.outlineVariant,
                    lineWidth: isSelected ? DesignTokens.BorderWidth.thick : DesignTokens.BorderWidth.thin
                )
            }
            .contentShape(cardShape)
        }
        .plainPressedButtonStyle()
        .sensoryFeedback(.selection, trigger: isSelected)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var cardShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card, style: .continuous)
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.md) {
        ChoiceCard(
            title: "Le modèle et novembre",
            detail: "Loisirs & sport passe à 180.00 dans novembre. Disponible : 1'248.50 → 1'218.50",
            isSelected: true
        ) {}
        ChoiceCard(
            title: "Le modèle seulement",
            detail: "Novembre garde 150.00. Disponible inchangé.",
            isSelected: false
        ) {}
    }
    .padding()
    .background(Color.sheetBackground)
}
