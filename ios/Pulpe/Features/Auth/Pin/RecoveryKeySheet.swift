import SwiftUI

struct RecoveryKeySheet: View {
    let recoveryKey: String
    let onAcknowledge: () -> Void

    @State private var copied = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            warningIcon
            titleSection
            keyDisplay
            copyButton
            warningText
            Spacer()
            acknowledgeButton
        }
        .padding(DesignTokens.Spacing.xxl)
        .interactiveDismissDisabled()
    }

    // MARK: - Warning Icon

    private var warningIcon: some View {
        Image(systemName: "exclamationmark.triangle.fill")
            .font(.system(size: 44))
            .foregroundStyle(.yellow)
            .padding(.top, DesignTokens.Spacing.lg)
    }

    // MARK: - Title

    private var titleSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("Cle de recuperation")
                .font(PulpeTypography.onboardingTitle)
                .multilineTextAlignment(.center)

            Text("Note cette cle dans un endroit sur. Elle te permettra de retrouver l'acces a tes donnees si tu oublies ton code PIN.")
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Key Display

    private var keyDisplay: some View {
        Text(recoveryKey)
            .font(.system(.body, design: .monospaced))
            .kerning(1)
            .multilineTextAlignment(.center)
            .padding(DesignTokens.Spacing.xl)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                    .fill(Color.surfaceSecondary)
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
                Text(copied ? "Copie !" : "Copier")
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
        }
        .sensoryFeedback(.success, trigger: copied)
    }

    // MARK: - Warning Text

    private var warningText: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Color.errorPrimary)
            Text("Sans cette cle et sans ton code PIN, tes donnees financieres seront definitivement inaccessibles.")
                .font(.footnote)
                .foregroundStyle(Color.errorPrimary)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.errorBackground)
        )
    }

    // MARK: - Acknowledge Button

    private var acknowledgeButton: some View {
        Button {
            onAcknowledge()
        } label: {
            Text("J'ai note ma cle")
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
