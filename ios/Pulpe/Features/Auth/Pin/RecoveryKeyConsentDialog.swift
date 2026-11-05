import SwiftUI

/// Asks whether to create a recovery key now (V2 board « Clé · consentement »): a centered
/// card over a dimmed screen. Replaces the former system alert. « Plus tard » is the only way
/// out besides accepting, as with the alert; the VoiceOver escape gesture maps to it.
struct RecoveryKeyConsentDialog: View {
    let isPresented: Bool
    let onAccept: () -> Void
    let onLater: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            if isPresented {
                Color.black.opacity(DesignTokens.Opacity.strong)
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .accessibilityHidden(true)

                card
                    .transition(reduceMotion
                        ? .opacity
                        : .scale(scale: DesignTokens.Entry.dialogEntranceScale).combined(with: .opacity))
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: isPresented)
    }

    private var card: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "key")
                .font(PulpeTypography.labelLargeBold)
                .foregroundStyle(Color.accentInk)
                .frame(width: DesignTokens.Entry.dialogIconDisc, height: DesignTokens.Entry.dialogIconDisc)
                .background(Color.accentWash, in: .circle)
                .accessibilityHidden(true)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Créer ta clé de récupération ?")
                    .font(PulpeTypography.cardTitle)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Text("""
                    Si tu oublies ton code, cette clé est le seul moyen de retrouver tes montants. \
                    Ça prend une minute.
                    """)
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.textSecondary)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Button("Créer ma clé", action: onAccept)
                    .primaryButtonStyle()
                    .accessibilityIdentifier("recoveryConsentAccept")
                Button("Plus tard", action: onLater)
                    .tertiaryButtonStyle()
                    .accessibilityIdentifier("recoveryConsentLater")
            }
            .padding(.top, DesignTokens.Spacing.xs)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Spacing.md)
        .frame(maxWidth: DesignTokens.Entry.dialogMaxWidth)
        .background(Color.appBackground, in: .rect(cornerRadius: DesignTokens.CornerRadius.md))
        .shadow(DesignTokens.Shadow.elevated)
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape, onLater)
    }
}

#Preview {
    Color.surface.overlay {
        RecoveryKeyConsentDialog(isPresented: true, onAccept: {}, onLater: {})
    }
}
