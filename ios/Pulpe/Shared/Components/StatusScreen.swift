import SwiftUI

/// Full-screen centred status (maintenance, error, update): a tinted disc, a title, one
/// sentence, one primary action and an optional secondary one.
struct StatusScreen: View {
    enum Tone {
        case neutral
        case accent
        case over

        fileprivate var disc: Color {
            switch self {
            case .neutral: .sunk
            case .accent: .accentWash
            case .over: .overWash
            }
        }

        fileprivate var glyph: Color {
            switch self {
            case .neutral: .textSecondary
            case .accent: .accentInk
            case .over: .financialOverBudget
            }
        }
    }

    struct Action {
        let title: String
        let perform: () -> Void
    }

    let systemImage: String
    var tone: Tone = .accent
    var discSize: CGFloat = DesignTokens.Control.statusDisc
    let title: String
    let message: String
    var primary: Action?
    var secondary: Action?

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Spacer(minLength: DesignTokens.Spacing.none)

            Image(systemName: systemImage)
                .font(.system(size: discSize / 2.5, weight: .regular))
                .foregroundStyle(tone.glyph)
                .frame(width: discSize, height: discSize)
                .background(tone.disc, in: Circle())
                .accessibilityHidden(true)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.statusTitle)
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .accessibilityElement(children: .combine)

            Spacer(minLength: DesignTokens.Spacing.none)

            VStack(spacing: DesignTokens.Spacing.sm) {
                if let primary {
                    Button(primary.title, action: primary.perform)
                        .primaryButtonStyle()
                }
                if let secondary {
                    Button(secondary.title, action: secondary.perform)
                        .tertiaryButtonStyle()
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
    }
}

#Preview {
    StatusScreen(
        systemImage: "wrench.and.screwdriver",
        tone: .neutral,
        title: "Je fais une pause d'entretien",
        message: "Je reviens dans quelques minutes.",
        primary: .init(title: "Réessayer") {},
        secondary: .init(title: "Fermer") {}
    )
}
