import OSLog
import SwiftUI

// MARK: - Recovery Step

enum RecoveryStep: Equatable {
    case enterRecoveryKey
    case createPin
    case confirmPin
    case processing
}

// MARK: - View

struct PinRecoveryView: View {
    let onComplete: () -> Void
    let onCancel: () -> Void
    let onSessionExpired: () -> Void

    @State private var viewModel = PinRecoveryViewModel()
    @FocusState private var recoveryKeyFocus: Bool

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .sensoryFeedback(.error, trigger: viewModel.hapticError)
            .sensoryFeedback(.success, trigger: viewModel.hapticSuccess)
            // Firmer than the soft key tap, and not the notification triad that
            // ends the flow — the code is noted, type it again.
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: viewModel.hapticStepAdvance)
            .sheet(item: recoveryKeySheetItemBinding) { item in
                RecoveryKeySheet(recoveryKey: item.recoveryKey) {
                    onComplete()
                }
            }
            .alert("Clé de récupération", isPresented: $viewModel.showRecoveryKeyWarning) {
                Button("OK") { onComplete() }
            } message: {
                Text(AppLocale.string("""
                Ta récupération est réussie mais la nouvelle clé de récupération n'a pas pu être générée. \
                Tu peux en créer une depuis les réglages.
                """))
            }
            .onChange(of: viewModel.requiresReauthentication) { _, requiresReauthentication in
                guard requiresReauthentication else { return }
                onSessionExpired()
            }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if viewModel.step == .enterRecoveryKey {
            recoveryKeyStep
        } else {
            pinContent
        }
    }

    private var pinContent: some View {
        VStack(spacing: 0) {
            Spacer()

            switch viewModel.step {
            case .enterRecoveryKey:
                EmptyView()
            case .createPin:
                pinStep(
                    title: AppLocale.string("Nouveau code PIN"),
                    subtitle: AppLocale.string("\(PinConstants.length) chiffres")
                )
            case .confirmPin:
                pinStep(title: AppLocale.string("Confirme ton code"), subtitle: nil)
            case .processing:
                processingStep
            }

            Spacer().frame(height: DesignTokens.Spacing.lg)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Recovery Key Step

    private var recoveryKeyStep: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    HStack {
                        Button(action: onCancel) {
                            Image(systemName: "chevron.left")
                                .font(PulpeTypography.headline)
                                .foregroundStyle(Color.textPrimary)
                                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                                .background(Color.surfaceContainerLowest, in: .circle)
                                .shadow(DesignTokens.Shadow.card)
                        }
                        .plainPressedButtonStyle()
                        .accessibilityLabel("Retour")
                        Spacer()
                    }

                    VStack(spacing: DesignTokens.Spacing.md) {
                        Image(systemName: "key")
                            .font(PulpeTypography.title2)
                            .foregroundStyle(Color.accentInk)
                            .frame(width: DesignTokens.Entry.iconDisc, height: DesignTokens.Entry.iconDisc)
                            .background(Color.accentWash, in: .circle)
                            .accessibilityHidden(true)
                        Text("Code oublié ?")
                            .font(PulpeTypography.entryTitle)
                            .foregroundStyle(Color.textPrimary)
                            .accessibilityAddTraits(.isHeader)
                        Text("""
                        Entre la clé de récupération notée quand tu as créé ton code. \
                        Tu choisiras ensuite un nouveau code, qui protégera tes montants.
                        """)
                            .font(PulpeTypography.stepSubtitle)
                            .foregroundStyle(Color.textSecondary)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Clé de récupération")
                            .font(PulpeTypography.metricLabel)
                            .foregroundStyle(Color.textPrimary)
                        recoveryKeyInput
                    }

                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(PulpeTypography.footnote)
                            .foregroundStyle(Color.errorPrimary)
                            .transition(.opacity)
                    }

                    stepsCard
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            .pulpeBackground()
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: DesignTokens.Spacing.xs) {
                    continueButton
                    contactSupportLink
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.xs)
                .background(Color.appBackground)
            }
            .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.errorMessage)
            .toolbar(.hidden, for: .navigationBar)
            .task { recoveryKeyFocus = true }
        }
    }

    /// Where the person stands in the recovery: the first step is the one on screen.
    private var stepsCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Les étapes")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            VStack(spacing: 0) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, title in
                    if index > 0 { FormRowDivider() }
                    stepRow(number: index + 1, title: title, isCurrent: index == 0)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.md)
            .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
        }
        .accessibilityElement(children: .combine)
    }

    private func stepRow(number: Int, title: String, isCurrent: Bool) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Text("\(number)")
                .font(PulpeTypography.metricLabel)
                .monospacedDigit()
                .foregroundStyle(isCurrent ? Color.accentInk : Color.textSecondary)
                .frame(width: DesignTokens.Entry.stepBadge, height: DesignTokens.Entry.stepBadge)
                .background(
                    isCurrent ? Color.accentWash : Color.surfaceContainerHigh,
                    in: .rect(cornerRadius: DesignTokens.CornerRadius.sm)
                )
            Text(title)
                .font(isCurrent ? PulpeTypography.rowTitle : PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: 0)
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }

    private var steps: [String] {
        [
            AppLocale.string("Ta clé de récupération"),
            AppLocale.string("Nouveau code, deux fois"),
            AppLocale.string("Nouvelle clé à noter")
        ]
    }

    private var recoveryKeyInput: some View {
        RecoveryKeyInputField(
            text: Binding(
                get: { viewModel.recoveryKeyInput },
                set: { viewModel.updateRecoveryKey($0) }
            ),
            isFocused: $recoveryKeyFocus
        )
    }

    private var continueButton: some View {
        Button("Continuer") {
            viewModel.submitRecoveryKey()
        }
        .disabled(!viewModel.isRecoveryKeyValid)
        .primaryButtonStyle(isEnabled: viewModel.isRecoveryKeyValid)
    }

    // MARK: - PIN Steps

    private func pinStep(title: String, subtitle: String?) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimary)

                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.stepSubtitle)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Spacer().frame(height: DesignTokens.Spacing.sectionGap)

            PinDotsErrorView(
                enteredCount: viewModel.digits.count,
                maxDigits: viewModel.pinLength,
                isError: viewModel.isError,
                errorMessage: viewModel.errorMessage
            )

            Spacer().frame(height: DesignTokens.Spacing.stepHeaderTop)

            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                isDisabled: viewModel.isProcessing || viewModel.isError
            )

            Spacer().frame(height: DesignTokens.Spacing.xxl)

            Button("Revenir") {
                viewModel.goBack()
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    // MARK: - Processing Step

    private var processingStep: some View {
        PinProcessingView(
            title: AppLocale.string("Récupération en cours..."),
            subtitle: AppLocale.string("Je protège tes données avec ton nouveau code")
        )
    }

    private var contactSupportLink: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Tu n'as plus ta clé ?")
                .foregroundStyle(Color.textSecondary)
            Link("Contacter le support", destination: AppURLs.support)
                .fontWeight(.semibold)
                .foregroundStyle(Color.pulpePrimary)
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .accessibilityIdentifier("contactSupportLink")
        }
        .font(PulpeTypography.subheadline)
    }

    private var recoveryKeySheetItemBinding: Binding<RecoveryKeySheetItem?> {
        Binding<RecoveryKeySheetItem?>(
            get: {
                guard viewModel.showRecoverySheet, let key = viewModel.newRecoveryKey else { return nil }
                return RecoveryKeySheetItem(recoveryKey: key)
            },
            set: { item in
                guard item == nil else { return }
                viewModel.showRecoverySheet = false
            }
        )
    }
}

// MARK: - Preview

#Preview {
    PinRecoveryView(
        onComplete: {},
        onCancel: {},
        onSessionExpired: {}
    )
}
