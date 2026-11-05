import SwiftUI

struct RecoveryKeySheet: View {
    let recoveryKey: String
    let onAcknowledge: () -> Void

    /// Clipboard auto-expires after 2 minutes for security
    private static let clipboardExpirationSeconds: TimeInterval = 120

    @State private var copied = false
    @State private var copyResetTask: Task<Void, Never>?

    // Staggered entrance states
    @State private var showHeader = false
    @State private var showKey = false
    @State private var showWarning = false
    @State private var showButton = false

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
                .blurSlide(showButton)
        }
        .interactiveDismissDisabled()
        .presentationDragIndicator(.hidden)
        .presentationBackground(Color.appBackground)
        .allowsHitTesting(showButton)
        .task {
            guard !showHeader else { return }
            await delayedAnimation(0.3, animation: DesignTokens.Animation.entranceSpring) {
                showHeader = true
            }
            await delayedAnimation(0.2, animation: DesignTokens.Animation.defaultSpring) {
                showKey = true
            }
            await delayedAnimation(0.2) { showWarning = true }
            await delayedAnimation(0.15) { showButton = true }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ZStack {
                Circle()
                    .fill(Color.pulpePrimary.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: DesignTokens.IconSize.heroBadge, height: DesignTokens.IconSize.heroBadge)

                Image(systemName: "key.horizontal.fill")
                    .font(PulpeTypography.title2)
                    .foregroundStyle(Color.pulpePrimary)
            }

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Ta clé de récupération")
                    .font(PulpeTypography.entryTitle)
                    .multilineTextAlignment(.center)

                Text(AppLocale.string("""
                Si tu oublies ton code, cette clé est le seul moyen de retrouver tes montants. \
                Note-la sur papier ou dans ton gestionnaire de mots de passe.
                """))
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .blurSlide(showHeader)
    }

    // MARK: - Key Card

    private var keyCard: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Text(RecoveryKeyFormatter.format(recoveryKey).replacingOccurrences(of: "-", with: " "))
                .font(.system(.body, design: .monospaced))
                .kerning(1.5)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
                .privacySensitive()

            Button {
                UIPasteboard.general.setItems(
                    [[UIPasteboard.typeAutomatic: recoveryKey]],
                    options: [
                        .expirationDate: Date().addingTimeInterval(Self.clipboardExpirationSeconds),
                        .localOnly: true
                    ]
                )
                withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                    copied = true
                }
                copyResetTask?.cancel()
                copyResetTask = Task {
                    try? await Task.sleep(for: .seconds(2))
                    guard !Task.isCancelled else { return }
                    withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                        copied = false
                    }
                }
            } label: {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                        .contentTransition(.symbolEffect(.replace))
                    Text(copied ? "Copié !" : "Copier la clé")
                }
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.accentInk)
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(Color.accentWash, in: .capsule)
            }
            .plainPressedButtonStyle()
            .contentShape(.capsule)
            .sensoryFeedback(.success, trigger: copied)
            .accessibilityLabel(
                copied ? "Clé copiée" : "Copier la clé de récupération"
            )

            Text("La copie s'efface après 2 minutes.")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity)
        .background {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous)
                .fill(Color.surface)
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg, style: .continuous)
                        .strokeBorder(Color.outlineVariant.opacity(0.3), lineWidth: DesignTokens.BorderWidth.thin)
                }
        }
        .scaleEffect(showKey ? 1 : 0.95)
        .opacity(showKey ? 1 : 0)
    }

    // MARK: - Warning Text

    private var warningText: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.financialOverBudget)
            Text(AppLocale.string("""
            Sans cette clé et sans ton code, tes montants restent illisibles pour de bon. \
            Je ne peux pas les retrouver pour toi.
            """))
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.textPrimary)
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.overWash,
            in: .rect(cornerRadius: DesignTokens.CornerRadius.md)
        )
        .blurSlide(showWarning)
    }

    // MARK: - Acknowledge Button

    private var acknowledgeButton: some View {
        Button {
            onAcknowledge()
        } label: {
            Text("J'ai noté ma clé")
        }
        .primaryButtonStyle()
    }
}

#Preview {
    RecoveryKeySheet(
        recoveryKey: "ABCD-EFGH-IJKL-MNOP-QRST",
        onAcknowledge: {}
    )
}
