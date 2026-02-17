import SwiftUI

struct RecoveryKeySheet: View {
    let recoveryKey: String
    let onAcknowledge: () -> Void

    @State private var copied = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    headerSection
                    keyCard
                    warningText
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.top, DesignTokens.Spacing.xxxl)
                .padding(.bottom, DesignTokens.Spacing.xxl)
            }
            .scrollBounceBehavior(.basedOnSize)

            acknowledgeButton
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .pulpeBackground()
        .interactiveDismissDisabled()
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "key.horizontal.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.pulpePrimary)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Clé de récupération")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)

                Text("Note cette clé dans un endroit sûr. Elle te permettra de retrouver l'accès à tes données si tu oublies ton code PIN.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Key Card

    private var keyCard: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Text(RecoveryKeyFormatter.format(recoveryKey))
                .font(.system(.body, design: .monospaced))
                .kerning(1.5)
                .multilineTextAlignment(.center)
                .textSelection(.enabled)

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
                    Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                        .contentTransition(.symbolEffect(.replace))
                    Text(copied ? "Copié !" : "Copier la clé")
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.pulpePrimary)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(
                    Color.pulpePrimary.opacity(0.1),
                    in: .capsule
                )
            }
            .sensoryFeedback(.success, trigger: copied)
        }
        .padding(DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous)
                .fill(Color.surfaceCard)
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous)
                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
                }
        }
    }

    // MARK: - Warning Text

    private var warningText: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.subheadline)
                .foregroundStyle(Color.warningPrimary)
            Text("Sans cette clé et sans ton code PIN, tes données financières seront définitivement inaccessibles.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.warningBackground,
            in: .rect(cornerRadius: DesignTokens.CornerRadius.md)
        )
    }

    // MARK: - Acknowledge Button

    private var acknowledgeButton: some View {
        Button {
            onAcknowledge()
        } label: {
            Text("J'ai noté ma clé")
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.pulpePrimary)
                .foregroundStyle(.white)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        }
    }
}

#Preview {
    RecoveryKeySheet(
        recoveryKey: "ABCD-EFGH-IJKL-MNOP-QRST",
        onAcknowledge: {}
    )
}
