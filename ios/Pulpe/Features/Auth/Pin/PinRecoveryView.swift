import OSLog
import SwiftUI

struct PinRecoveryView: View {
    let onComplete: () -> Void
    let onCancel: () -> Void

    @State private var viewModel = PinRecoveryViewModel()

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .sheet(isPresented: $viewModel.showRecoverySheet) {
            if let key = viewModel.newRecoveryKey {
                RecoveryKeySheet(recoveryKey: key) {
                    onComplete()
                }
            }
        }
        .alert("Clé de récupération", isPresented: $viewModel.showRecoveryKeyWarning) {
            Button("OK") {
                onComplete()
            }
        } message: {
            Text("Ta récupération est réussie mais la nouvelle clé de récupération n'a pas pu être générée. Tu peux en créer une depuis les réglages.")
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
                pinStep(title: "Nouveau code PIN", subtitle: "4 chiffres minimum")
            case .confirmPin:
                pinStep(title: "Confirme ton code PIN", subtitle: nil)
            case .processing:
                processingStep
            }

            Spacer().frame(height: 16)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Recovery Key Step

    private var recoveryKeyStep: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            Image(systemName: "key.fill")
                .font(.system(size: 48))
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
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .transition(.opacity)
            }

            recoverButton

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

    private var recoverButton: some View {
        Button {
            viewModel.submitRecoveryKey()
        } label: {
            Text("Continuer")
                .font(PulpeTypography.buttonPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background {
                    if viewModel.isRecoveryKeyValid {
                        Color.onboardingGradient
                    } else {
                        Color(uiColor: .systemGray4)
                    }
                }
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

            Spacer().frame(height: 40)

            VStack(spacing: DesignTokens.Spacing.md) {
                PinDotsView(
                    enteredCount: viewModel.digits.count,
                    maxDigits: viewModel.maxDigits,
                    isError: viewModel.isError
                )

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.errorMessage)

            Spacer().frame(height: 48)

            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                onConfirm: viewModel.canConfirm ? {
                    Task { await viewModel.confirmPin() }
                } : nil,
                isDisabled: viewModel.isProcessing
            )

            Spacer().frame(height: 24)

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
        VStack(spacing: DesignTokens.Spacing.xl) {
            ProgressView()
                .tint(Color.textPrimaryOnboarding)
                .scaleEffect(1.5)

            Text("Récupération en cours...")
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            Text("Tes données sont en cours de re-chiffrement")
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
        }
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
}

// MARK: - Step

enum RecoveryStep {
    case enterRecoveryKey
    case createPin
    case confirmPin
    case processing
}

// MARK: - ViewModel

@Observable @MainActor
final class PinRecoveryViewModel {
    private(set) var step: RecoveryStep = .enterRecoveryKey
    private(set) var digits: [Int] = []
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var isProcessing = false
    private(set) var newRecoveryKey: String?
    var showRecoverySheet = false
    var showRecoveryKeyWarning = false
    var recoveryKeyInput = ""

    let maxDigits = 6
    let minDigits = 4

    private var recoveryKey = ""
    private var firstPin: String?
    private let cryptoService = CryptoService.shared
    private let encryptionAPI = EncryptionAPI.shared
    private let clientKeyManager = ClientKeyManager.shared

    var isRecoveryKeyValid: Bool {
        // Base32 recovery key (256-bit): 52 characters
        let stripped = RecoveryKeyFormatter.strip(recoveryKey)
        return stripped.count == 52
    }

    var canConfirm: Bool {
        digits.count >= minDigits && !isProcessing
    }

    // MARK: - Recovery Key

    func updateRecoveryKey(_ input: String) {
        let formatted = RecoveryKeyFormatter.format(input)
        recoveryKeyInput = formatted
        recoveryKey = RecoveryKeyFormatter.strip(formatted)
        errorMessage = nil
    }

    func submitRecoveryKey() {
        guard isRecoveryKeyValid else { return }
        step = .createPin
        errorMessage = nil
    }

    // MARK: - PIN Input

    func appendDigit(_ digit: Int) {
        guard digits.count < maxDigits, !isProcessing else { return }
        digits.append(digit)

        if digits.count == maxDigits {
            Task { await handlePinComplete() }
        }
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isProcessing else { return }
        digits.removeLast()
        isError = false
        errorMessage = nil
    }

    func confirmPin() async {
        guard canConfirm else { return }
        await handlePinComplete()
    }

    func goBack() {
        switch step {
        case .createPin:
            step = .enterRecoveryKey
            digits = []
            firstPin = nil
        case .confirmPin:
            step = .createPin
            digits = []
        default:
            break
        }
        isError = false
        errorMessage = nil
    }

    // MARK: - Private

    private var pinString: String {
        digits.map(String.init).joined()
    }

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

    private func executeRecovery() async {
        step = .processing
        isProcessing = true

        guard let pin = firstPin else { return }

        do {
            // 1. Get salt & KDF params
            let saltResponse = try await encryptionAPI.getSalt()

            // 2. Derive new clientKey from new PIN
            let newClientKeyHex = try await cryptoService.deriveClientKey(
                pin: pin,
                saltHex: saltResponse.salt,
                iterations: saltResponse.kdfIterations
            )

            // 3. Recover with recovery key + new clientKey
            try await encryptionAPI.recover(
                recoveryKey: recoveryKey,
                newClientKeyHex: newClientKeyHex
            )

            // 4. Store new clientKey
            await clientKeyManager.store(newClientKeyHex, enableBiometric: false)

            // 5. Generate new recovery key
            do {
                let key = try await encryptionAPI.setupRecoveryKey()
                newRecoveryKey = key
                showRecoverySheet = true
            } catch {
                // Non-blocking: user can regenerate from settings later
                Logger.encryption.warning("Recovery key setup failed after recovery: \(error.localizedDescription)")
                newRecoveryKey = nil
                showRecoverySheet = false
                showRecoveryKeyWarning = true
            }

            isProcessing = false

        } catch let error as APIError {
            isProcessing = false
            handleRecoveryError(error)
        } catch {
            isProcessing = false
            step = .enterRecoveryKey
            digits = []
            firstPin = nil
            showError("Une erreur est survenue, réessaie")
        }
    }

    private func handleRecoveryError(_ error: APIError) {
        step = .enterRecoveryKey
        digits = []
        firstPin = nil

        switch error {
        case .validationError:
            showError("Clé de récupération invalide — vérifie que tu as bien copié la clé")
        case .rateLimited:
            showError("Trop de tentatives, patiente un moment")
        case .networkError:
            showError("Erreur de connexion, réessaie")
        default:
            showError("Une erreur est survenue, réessaie")
        }
    }

    private func showError(_ message: String) {
        errorMessage = message
        isError = true

        Task {
            try? await Task.sleep(for: .seconds(2))
            isError = false
        }
    }
}

#Preview {
    PinRecoveryView(
        onComplete: {},
        onCancel: {}
    )
}
