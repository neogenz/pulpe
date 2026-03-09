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

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .sheet(item: recoveryKeySheetItemBinding) { item in
                RecoveryKeySheet(recoveryKey: item.recoveryKey) {
                    onComplete()
                }
            }
            .alert("Clé de récupération", isPresented: $viewModel.showRecoveryKeyWarning) {
                Button("OK") { onComplete() }
            } message: {
                Text(
                    "Ta récupération est réussie mais la nouvelle clé de récupération n'a pas pu être générée. "
                    + "Tu peux en créer une depuis les réglages."
                )
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
                pinStep(title: "Nouveau code PIN", subtitle: "4 chiffres")
            case .confirmPin:
                pinStep(title: "Confirme ton code PIN", subtitle: nil)
            case .processing:
                processingStep
            }

            Spacer().frame(height: DesignTokens.Spacing.lg)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Recovery Key Step

    private var recoveryKeyStep: some View {
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
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.errorMessage)
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
                .stroke(Color.pinInputBorder, lineWidth: 1)
        )
        .foregroundStyle(Color.textPrimaryOnboarding)
    }

    private var continueButton: some View {
        Button {
            viewModel.submitRecoveryKey()
        } label: {
            Text("Continuer")
                .font(PulpeTypography.buttonPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(
                    viewModel.isRecoveryKeyValid
                        ? AnyShapeStyle(Color.onboardingGradient)
                        : AnyShapeStyle(Color(uiColor: .systemGray4))
                )
                .foregroundStyle(Color.textOnPrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
        .disabled(!viewModel.isRecoveryKeyValid)
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
                maxDigits: viewModel.maxDigits,
                isError: viewModel.isError,
                errorMessage: viewModel.errorMessage
            )

            Spacer().frame(height: DesignTokens.Spacing.stepHeaderTop)

            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                onConfirm: viewModel.canConfirm ? {
                    Task { await viewModel.confirmPin() }
                } : nil,
                isDisabled: viewModel.isProcessing
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
            title: "Récupération en cours...",
            subtitle: "Tes données sont en cours de re-chiffrement"
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

// MARK: - ViewModel

@Observable @MainActor
final class PinRecoveryViewModel {
    // MARK: - Public State

    private(set) var step: RecoveryStep = .enterRecoveryKey
    private(set) var digits: [Int] = []
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var isProcessing = false
    private(set) var requiresReauthentication = false
    private(set) var newRecoveryKey: String?
    var showRecoverySheet = false
    var showRecoveryKeyWarning = false
    var recoveryKeyInput = ""

    let pinLength = PinConstants.length
    var maxDigits: Int { pinLength }

    var isRecoveryKeyValid: Bool { RecoveryKeyFormatter.strip(recoveryKey).count == 52 }
    var canConfirm: Bool { digits.count == pinLength && !isProcessing }

    // MARK: - Private

    private var recoveryKey = ""
    private var firstPin: String?
    private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinCryptoKeyDerivation
    private let encryptionAPI: any PinEncryptionRecovery
    private let clientKeyManager: any PinClientKeyStorage

    // MARK: - Init

    init(
        cryptoService: any PinCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinEncryptionRecovery = EncryptionAPI.shared,
        clientKeyManager: any PinClientKeyStorage = ClientKeyManager.shared
    ) {
        self.cryptoService = cryptoService
        self.encryptionAPI = encryptionAPI
        self.clientKeyManager = clientKeyManager
    }

    // MARK: - Recovery Key Actions

    func updateRecoveryKey(_ input: String) {
        if RecoveryKeyFormatter.containsInvalidCharacters(input) {
            errorMessage = "Ta clé contient des caractères invalides"
        } else {
            errorMessage = nil
        }

        let formatted = RecoveryKeyFormatter.format(input)
        recoveryKeyInput = formatted
        recoveryKey = RecoveryKeyFormatter.strip(formatted)
    }

    func submitRecoveryKey() {
        guard isRecoveryKeyValid else { return }
        step = .createPin
        errorMessage = nil
        requiresReauthentication = false
    }

    // MARK: - PIN Input Actions

    func appendDigit(_ digit: Int) {
        guard digits.count < pinLength, !isProcessing else { return }
        if isError { clearError() }
        digits.append(digit)
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isProcessing else { return }
        digits.removeLast()
        clearError()
    }

    func confirmPin() async {
        guard canConfirm else { return }
        await handlePinComplete()
    }

    func goBack() {
        switch step {
        case .createPin:
            recoveryKeyInput = ""
            recoveryKey = ""
            step = .enterRecoveryKey
            digits = []
            firstPin = nil
        case .confirmPin:
            step = .createPin
            digits = []
        default:
            break
        }
        clearError()
    }

    // MARK: - PIN Flow

    private func handlePinComplete() async {
        switch step {
        case .createPin:
            firstPin = pinString
            step = .confirmPin
            digits = []
        case .confirmPin:
            if pinString == firstPin {
                await executeRecovery()
            } else {
                showError("Les codes ne correspondent pas")
            }
        default:
            break
        }
    }

    private var pinString: String { digits.map(String.init).joined() }

    // MARK: - Recovery Execution

    private func executeRecovery() async {
        step = .processing
        isProcessing = true
        requiresReauthentication = false

        guard let pin = firstPin else { return }

        do {
            // 1. Derive new clientKey from new PIN
            let result = try await PinValidation.derive(
                pin: pin,
                cryptoService: cryptoService,
                encryptionAPI: encryptionAPI
            )

            // 2. Recover with recovery key + new clientKey
            try await encryptionAPI.recover(
                recoveryKey: recoveryKey,
                newClientKeyHex: result.clientKeyHex
            )

            // 3. Store new clientKey
            await clientKeyManager.store(result.clientKeyHex, enableBiometric: false)

            // 5. Generate new recovery key (non-blocking)
            await generateNewRecoveryKey()

            firstPin = nil
            isProcessing = false
        } catch let error as APIError {
            isProcessing = false
            handleRecoveryError(error)
        } catch {
            isProcessing = false
            retryFromCurrentStep()
            showError("Une erreur est survenue, réessaie")
        }
    }

    private func generateNewRecoveryKey() async {
        do {
            let key = try await encryptionAPI.regenerateRecoveryKey()
            newRecoveryKey = key
            showRecoverySheet = true
        } catch {
            Logger.encryption.warning("Recovery key setup failed after recovery: \(error.localizedDescription)")
            newRecoveryKey = nil
            showRecoverySheet = false
            showRecoveryKeyWarning = true
        }
    }

    // MARK: - Error Handling

    private func handleRecoveryError(_ error: APIError) {
        switch error {
        case .unauthorized, .forbidden:
            requiresReauthentication = true
            step = .confirmPin
            digits = []
            showError("Ta session a expiré — reconnecte-toi")
        case .recoveryKeyInvalid:
            resetToRecoveryKeyStep()
            showError("Clé de récupération invalide — vérifie que tu as bien copié la clé")
        case .validationError:
            resetToRecoveryKeyStep()
            showError("Clé de récupération invalide — vérifie que tu as bien copié la clé")
        case .rateLimited:
            retryFromCurrentStep()
            showError("Trop de tentatives, patiente un moment")
        case .networkError:
            retryFromCurrentStep()
            showError("Erreur de connexion, réessaie")
        default:
            retryFromCurrentStep()
            showError("Une erreur est survenue, réessaie")
        }
    }

    private func retryFromCurrentStep() {
        step = .confirmPin
        digits = []
        // Keep firstPin and recoveryKey intact — user can retry without re-entering
    }

    private func resetToRecoveryKeyStep() {
        recoveryKeyInput = ""
        recoveryKey = ""
        step = .enterRecoveryKey
        digits = []
        firstPin = nil
        requiresReauthentication = false
    }

    private func showError(_ message: String) {
        errorMessage = message
        isError = true
        digits = []

        errorResetTask?.cancel()
        errorResetTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            clearError()
        }
    }

    private func clearError() {
        isError = false
        errorMessage = nil
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
