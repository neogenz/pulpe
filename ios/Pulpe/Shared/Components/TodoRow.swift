import SwiftUI

/// A row of an action card (V2 `todo`): a 40pt tinted disc with a glyph, a 16pt semibold
/// title, one 13pt fact under it, a chevron. Reused by « À faire » and « Pour bien démarrer ».
struct TodoRow: View {
    enum Tone {
        case calm
        case warning

        fileprivate var tint: Color { self == .calm ? .pulpePrimary : .financialOverBudget }
        fileprivate var wash: Color { self == .calm ? .accentWash : .overWash }
    }

    let systemImage: String
    var tone: Tone = .calm
    let title: String
    let subtitle: String
    /// Whether the subtitle holds figures or names the privacy mode blurs.
    var blursSubtitle = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: systemImage)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(tone.tint)
                    .frame(width: DesignTokens.TodoRow.disc, height: DesignTokens.TodoRow.disc)
                    .background(tone.wash, in: Circle())
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(title)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.leading)
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.leading)
                        .modifier(OptionalSensitiveAmount(isActive: blursSubtitle))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                RowChevron()
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .contentShape(Rectangle())
        }
        .plainPressedButtonStyle()
    }
}

private struct OptionalSensitiveAmount: ViewModifier {
    let isActive: Bool

    func body(content: Content) -> some View {
        if isActive { content.sensitiveAmount() } else { content }
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.none) {
        TodoRow(
            systemImage: "checkmark.circle", title: "4 mouvements à pointer",
            subtitle: "Migros, Café Lomi et 2 autres", action: {}
        )
        Divider().overlay(Color.outlineVariant)
        TodoRow(
            systemImage: "chart.line.uptrend.xyaxis", tone: .warning, title: "Courses et Sorties dépassent",
            subtitle: "102.20 au-delà du prévu, à rattraper", action: {}
        )
    }
    .pulpeSurfaceCard()
    .padding()
    .background(Color.appBackground)
}
