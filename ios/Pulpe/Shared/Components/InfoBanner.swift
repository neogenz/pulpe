import SwiftUI

/// Inline information (V2 `banner`): a tinted block with a glyph and a sentence. Never a button.
struct InfoBanner<Content: View>: View {
    enum Style {
        case neutral
        case over
        case ok
        case err

        fileprivate var fill: Color {
            switch self {
            case .neutral: .sunk
            case .over: .overWash
            case .ok: .accentWash
            case .err: .destructiveBackground
            }
        }

        fileprivate var glyph: Color {
            switch self {
            case .neutral: .textSecondary
            case .over: .financialOverBudget
            case .ok: .pulpePrimary
            case .err: .destructivePrimary
            }
        }
    }

    let style: Style
    let systemImage: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.compactGap) {
            Image(systemName: systemImage)
                .font(.system(size: DesignTokens.Control.bannerGlyph, weight: .regular))
                .foregroundStyle(style.glyph)
                .accessibilityHidden(true)
            content()
                .font(PulpeTypography.bannerText)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg - DesignTokens.BorderWidth.thick)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(style.fill, in: .rect(cornerRadius: DesignTokens.CornerRadius.inset))
        .accessibilityElement(children: .combine)
    }
}

extension InfoBanner where Content == Text {
    init(_ style: Style, systemImage: String, text: String) {
        self.init(style: style, systemImage: systemImage) { Text(text) }
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.md) {
        InfoBanner(.neutral, systemImage: "info.circle", text: "Le surplus n'est plus couvert.")
        InfoBanner(.over, systemImage: "exclamationmark.circle", text: "Cette prévision est déjà dépassée.")
        InfoBanner(.ok, systemImage: "checkmark.circle", text: "Disponible inchangé.")
        InfoBanner(.err, systemImage: "xmark.circle", text: "Je n'ai pas pu enregistrer.")
    }
    .padding()
    .background(Color.appBackground)
}
