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
    private enum RecoveryKeyField: Hashable {
        case recoveryKey
    }

    let onComplete: () -> Void
    let onCancel: () -> Void
    let onSessionExpired: () -> Void

    @State private var viewModel = PinRecoveryViewModel()
    @FocusState private var recoveryKeyFocus: RecoveryKeyField?

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

    private var content: some View {
        VStack(spacing: 0) {
            Spacer()

            switch viewModel.step {
            case .enterRecoveryKey:
                recoveryKeyStep
            case .createPin:
                pinStep(
                    title: AppLocale.string("Nouveau code PIN"),
                    subtitle: AppLocale.string("\(PinConstants.length) chiffres")
                )
            case .confirmPin:
                pinStep(title: AppLocale.string("Confirme ton code PIN"), subtitle: nil)
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
            VStack(spacing: DesignTokens.Spacing.xxl) {
                Image(systemName: "key.fill")
                    .font(PulpeTypography.heroIcon)
                    .foregroundStyle(Color.textSecondaryOnboarding)

                VStack(spacing: DesignTokens.Spacing.sm) {
                    Text("Clé de récupération")
                        .font(PulpeTypography.onboardingTitle)
                        .foregroundStyle(Color.textPrimaryOnboarding)

                    Text("Entre la clé de récupération que tu as notée lors de la configuration de ton code PIN")
                        .font(PulpeTypography.stepSubtitle)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                }

                recoveryKeyInput

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.errorPrimary)
                        .transition(.opacity)
                }

                continueButton
                cancelButton
                contactSupportLink
            }
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.errorMessage)
            .toolbar(.hidden, for: .navigationBar)
            .keyboardFieldNavigation(focus: $recoveryKeyFocus, order: [.recoveryKey])
            .task {
                recoveryKeyFocus = .recoveryKey
            }
        }
    }

    private var recoveryKeyInput: some View {
        TextField("XXXX-XXXX-XXXX-XXXX-...", text: Binding(
            get: { viewModel.recoveryKeyInput },
            set: { viewModel.updateRecoveryKey($0) }
        ))
        .font(.system(.body, design: .monospaced))
        .kerning(1)
        .multilineTextAlignment(.center)
        .autocorrectionDisabled()
        .textInputAutocapitalization(.characters)
        .textContentType(.oneTimeCode)
        .privacySensitive()
        .padding(DesignTokens.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .fill(Color.pinInputBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .stroke(Color.pinInputBorder, lineWidth: DesignTokens.BorderWidth.thin)
        )
        .foregroundStyle(Color.textPrimaryOnboarding)
        .focused($recoveryKeyFocus, equals: .recoveryKey)
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
                    .foregroundStyle(Color.textPrimaryOnboarding)

                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.stepSubtitle)
                        .foregroundStyle(Color.textSecondaryOnboarding)
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

            Button {
                viewModel.goBack()
            } label: {
                Text("Revenir")
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
        }
    }

    // MARK: - Processing Step

    private var processingStep: some View {
        PinProcessingView(
            title: AppLocale.string("Récupération en cours..."),
            subtitle: AppLocale.string("Tes données sont en cours de re-chiffrement")
        )
    }

    // MARK: - Cancel Button

    private var cancelButton: some View {
        Button {
            onCancel()
        } label: {
            Text("Annuler")
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
    }

    private var contactSupportLink: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text("Tu n'as plus ta clé de récupération ?")
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
            Link("Contacter le support", destination: AppURLs.support)
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
