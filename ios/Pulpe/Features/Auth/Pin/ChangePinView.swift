import OSLog
import SwiftUI

// MARK: - Step

enum ChangePinStep: Equatable {
    case enterOldPin
    case enterNewPin
    case processing
}

// MARK: - View

struct ChangePinView: View {
    let onSuccess: () -> Void

    @State private var viewModel = ChangePinViewModel()
    @Environment(AppState.self) private var appState

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .navigationTitle("Code PIN")
            .navigationBarTitleDisplayMode(.inline)
            .sensoryFeedback(.error, trigger: viewModel.hapticError)
            .sensoryFeedback(.success, trigger: viewModel.hapticSuccess)
            .onAppear { viewModel.biometricEnabled = appState.biometricEnabled }
            .sheet(item: recoveryKeySheetBinding) { item in
                RecoveryKeySheet(recoveryKey: item.recoveryKey) {
                    viewModel.clearRecoveryKey()
                    onSuccess()
                }
            }
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
            Spacer()

            switch viewModel.step {
            case .enterOldPin:
                pinStep(title: "Saisis ton ancien code PIN")
            case .enterNewPin:
                pinStep(title: "Saisis ton nouveau code PIN")
            case .processing:
                processingStep
            }

            Spacer().frame(height: DesignTokens.Spacing.lg)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - PIN Step

    private func pinStep(title: String) -> some View {
        VStack(spacing: 0) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(title)
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                Text(viewModel.stepLabel)
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
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
                    Task { await viewModel.confirm() }
                } : nil,
                isDisabled: viewModel.isProcessing
            )

            Spacer().frame(height: DesignTokens.Spacing.xxl)

            if viewModel.step == .enterNewPin {
                Button {
                    viewModel.goBack()
                } label: {
                    Text("Revenir")
                        .font(PulpeTypography.stepSubtitle)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                }
                .accessibilityHint("Revenir à l'étape précédente")
            }
        }
    }

    // MARK: - Processing Step

    private var processingStep: some View {
        PinProcessingView(
            title: "Changement en cours...",
            subtitle: "Tes données sont en cours de re-chiffrement"
        )
    }

    // MARK: - Recovery Key Sheet Binding

    private var recoveryKeySheetBinding: Binding<RecoveryKeySheetItem?> {
        Binding<RecoveryKeySheetItem?>(
            get: {
                guard let key = viewModel.recoveryKey else { return nil }
                return RecoveryKeySheetItem(recoveryKey: key)
            },
            set: { item in
                guard item == nil else { return }
                viewModel.clearRecoveryKey()
            }
        )
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class ChangePinViewModel {
    // MARK: - Public State

    private(set) var step: ChangePinStep = .enterOldPin
    private(set) var digits: [Int] = []
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var isProcessing = false
    private(set) var hapticSuccess = false
    private(set) var hapticError = false
    private(set) var recoveryKey: String?

    let maxDigits = 6
    let minDigits = 4

    var canConfirm: Bool {
        digits.count >= minDigits && !isProcessing
    }

    var stepLabel: String {
        switch step {
        case .enterOldPin: "Étape 1 sur 2"
        case .enterNewPin: "Étape 2 sur 2"
        case .processing: ""
        }
    }

    var biometricEnabled = false

    private var pinString: String {
        digits.map(String.init).joined()
    }

    // MARK: - Private

    private static let logger = Logger(subsystem: "com.pulpe.app", category: "ChangePinViewModel")
    private var oldClientKeyHex: String?
    private var cachedSalt: EncryptionSaltResponse?
    nonisolated(unsafe) private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinCryptoKeyDerivation
    private let encryptionAPI: any PinEncryptionChangePin
    private let clientKeyManager: any PinClientKeyStorage

    deinit {
        errorResetTask?.cancel()
    }

    // MARK: - Init

    init(
        cryptoService: any PinCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinEncryptionChangePin = EncryptionAPI.shared,
        clientKeyManager: any PinClientKeyStorage = ClientKeyManager.shared
    ) {
        self.cryptoService = cryptoService
        self.encryptionAPI = encryptionAPI
        self.clientKeyManager = clientKeyManager
    }

    // MARK: - Actions

    func appendDigit(_ digit: Int) {
        guard digits.count < maxDigits, !isProcessing else { return }
        if isError { clearError() }
        digits.append(digit)

        if digits.count == maxDigits {
            isProcessing = true
            Task { await handlePinComplete() }
        }
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isProcessing else { return }
        digits.removeLast()
        clearError()
    }

    func confirm() async {
        guard canConfirm else { return }
        isProcessing = true
        await handlePinComplete()
    }

    // MARK: - Flow

    private func handlePinComplete() async {
        switch step {
        case .enterOldPin:
            await validateOldPin()
        case .enterNewPin:
            await executeChangePin()
        case .processing:
            break
        }
    }

    func goBack() {
        guard !isProcessing else { return }
        step = .enterOldPin
        digits = []
        oldClientKeyHex = nil
        cachedSalt = nil
        clearError()
    }

    // MARK: - Old PIN Validation

    private func validateOldPin() async {
        defer { isProcessing = false }

        do {
            let result = try await PinValidation.deriveValidateAndStore(
                pin: pinString,
                cryptoService: cryptoService,
                encryptionAPI: encryptionAPI,
                clientKeyManager: clientKeyManager
            )
            oldClientKeyHex = result.clientKeyHex
            cachedSalt = result.saltResponse
            hapticSuccess.toggle()
            withAnimation(DesignTokens.Animation.stepTransition) {
                step = .enterNewPin
                digits = []
            }
        } catch let error as APIError {
            handleAPIError(error)
        } catch let error as CryptoServiceError {
            handleCryptoError(error)
        } catch {
            showError("Erreur inattendue, réessaie")
        }
    }

    // MARK: - Change PIN Execution

    private func executeChangePin() async {
        guard let oldClientKeyHex, let cachedSalt else { return }

        step = .processing
        defer { isProcessing = false }

        do {
            let result = try await PinValidation.derive(
                pin: pinString,
                cachedSalt: cachedSalt,
                cryptoService: cryptoService
            )

            guard result.clientKeyHex != oldClientKeyHex else {
                step = .enterNewPin
                digits = []
                showError("Le nouveau code doit être différent")
                return
            }

            let response = try await encryptionAPI.changePin(
                oldClientKeyHex: oldClientKeyHex,
                newClientKeyHex: result.clientKeyHex
            )

            await clientKeyManager.store(result.clientKeyHex, enableBiometric: biometricEnabled)
            self.oldClientKeyHex = nil
            self.cachedSalt = nil
            hapticSuccess.toggle()
            AnalyticsService.shared.capture(.pinChanged)
            recoveryKey = response.recoveryKey
        } catch let error as APIError {
            step = .enterNewPin
            handleAPIError(error)
        } catch let error as CryptoServiceError {
            step = .enterNewPin
            handleCryptoError(error)
        } catch {
            step = .enterNewPin
            showError("Erreur inattendue, réessaie")
        }
    }

    // MARK: - Error Handling

    private func handleAPIError(_ error: APIError) {
        Self.logger.warning("API error during PIN change: \(String(describing: error))")
        showError(error.pinValidationMessage)
    }

    private func handleCryptoError(_ error: CryptoServiceError) {
        Self.logger.error("Crypto error during PIN change: \(String(describing: error))")
        showError(error.pinUserMessage)
    }

    private func showError(_ message: String) {
        errorMessage = message
        isError = true
        digits = []
        hapticError.toggle()

        errorResetTask?.cancel()
        errorResetTask = Task {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            clearError()
        }
    }

    func clearRecoveryKey() {
        recoveryKey = nil
    }

    private func clearError() {
        isError = false
        errorMessage = nil
    }
}

// MARK: - Preview

#Preview {
    ChangePinView(onSuccess: {})
        .environment(AppState())
}
