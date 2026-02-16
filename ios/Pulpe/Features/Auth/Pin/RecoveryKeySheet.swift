import SwiftUI

struct RecoveryKeySheet: View {
    let recoveryKey: String
    let onAcknowledge: () -> Void

    @State private var copied = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                warningIcon
                titleSection
                keyDisplay
                copyButton
                warningText
            }
            .pulpeCard()

            Spacer()

            acknowledgeButton
        }
        .padding(DesignTokens.Spacing.xxl)
        .pulpeBackground()
        .interactiveDismissDisabled()
    }

    // MARK: - Warning Icon

    private var warningIcon: some View {
        Image(systemName: "exclamationmark.triangle")
            .font(.system(size: 44))
            .foregroundStyle(Color.warningPrimary)
            .padding(.top, DesignTokens.Spacing.sm)
    }

    // MARK: - Title

    private var titleSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("Clé de récupération")
                .font(PulpeTypography.onboardingTitle)
                .multilineTextAlignment(.center)

            Text("Note cette clé dans un endroit sûr. Elle te permettra de retrouver l'accès à tes données si tu oublies ton code PIN.")
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Key Display

    private var keyDisplay: some View {
        Text(RecoveryKeyFormatter.format(recoveryKey))
            .font(.system(.body, design: .monospaced))
            .kerning(1)
            .multilineTextAlignment(.center)
            .padding(DesignTokens.Spacing.xl)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                    .fill(Color.surfaceCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                            .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
                    )
            )
            .textSelection(.enabled)
    }

    // MARK: - Copy Button

    private var copyButton: some View {
        Button {
            UIPasteboard.general.string = recoveryKey
            withAnimation {
                copied = true
            }
            Task {
                try? await Task.sleep(for: .seconds(2))
                withAnimation {
                    copied = false
                }
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                Text(copied ? "Copié !" : "Copier")
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
        }
        .sensoryFeedback(.success, trigger: copied)
    }

    // MARK: - Warning Text

    private var warningText: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(Color.warningPrimary)
            Text("Sans cette clé et sans ton code PIN, tes données financières seront définitivement inaccessibles.")
                .font(.footnote)
                .foregroundStyle(Color.warningPrimary)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.warningBackground)
        )
    }

    // MARK: - Acknowledge Button

    private var acknowledgeButton: some View {
        Button {
            onAcknowledge()
        } label: {
            Text("J'ai noté ma clé")
                .font(PulpeTypography.buttonPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.onboardingGradient)
                .foregroundStyle(Color.textOnPrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
        .padding(.bottom, DesignTokens.Spacing.sm)
    }
}

#Preview {
    RecoveryKeySheet(
        recoveryKey: "ABCD-EFGH-IJKL-MNOP-QRST",
        onAcknowledge: {}
    )
}
