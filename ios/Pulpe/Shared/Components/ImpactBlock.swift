import SwiftUI

/// What an action does to a figure, shown before the user validates (V2 `impact`):
/// a caption title, then the "before" figure struck through in `ink3` → the "after" figure,
/// and an optional note. Without `before`, only the "after" figure is shown.
struct ImpactBlock: View {
    let title: String
    let before: Decimal?
    let after: Decimal
    let currency: SupportedCurrency
    var note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(title)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                if let before {
                    Text(before.asCurrency(currency))
                        .strikethrough(true, color: Color.textTertiary)
                        .foregroundStyle(Color.textTertiary)
                    Image(systemName: "arrow.right")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.textSecondary)
                        .accessibilityHidden(true)
                }
                Text(after.asCurrency(currency))
                    .foregroundStyle(Color.textPrimary)
            }
            .font(PulpeTypography.impactAmount)
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .lineLimit(1)

            if let note {
                Text(note)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg - DesignTokens.BorderWidth.thick)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.inset))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        var parts = [title]
        if let before {
            parts.append(AppLocale.string("avant") + " " + before.asCurrency(currency))
        }
        parts.append(AppLocale.string("après") + " " + after.asCurrency(currency))
        if let note { parts.append(note) }
        return parts.joined(separator: ", ")
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.lg) {
        ImpactBlock(
            title: "Ton disponible de novembre",
            before: 1248.50,
            after: 1108.50,
            currency: .chf
        )
        ImpactBlock(
            title: "Ton disponible de novembre",
            before: nil,
            after: 1108.50,
            currency: .chf,
            note: "Rien ne change"
        )
    }
    .padding()
    .background(Color.surface)
}
