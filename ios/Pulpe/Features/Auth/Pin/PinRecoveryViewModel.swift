import OSLog
import SwiftUI

/// Split out of `PinRecoveryView.swift`: co-located, it pushed that file past
/// the 500-line ceiling SwiftLint enforces in strict mode.
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
    private(set) var hapticSuccess = false
    private(set) var hapticError = false
    private(set) var hapticStepAdvance = false
    var showRecoverySheet = false
    var showRecoveryKeyWarning = false
    var recoveryKeyInput = ""

    let pinLength = PinConstants.length

    var isRecoveryKeyValid: Bool {
        RecoveryKeyFormatter.strip(recoveryKey).count == RecoveryKeyFormatter.strippedKeyCharacterCount
    }

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
        guard digits.count < pinLength, !isProcessing, !isError else { return }
        digits.append(digit)

        guard digits.count == pinLength else { return }
        // Locks the numpad for the whole auto-submission, settle beat included.
        isProcessing = true
        Task { await autoSubmit() }
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isProcessing else { return }
        digits.removeLast()
        clearError()
    }

    /// Lets the last dot land on screen before the step swaps or the error
    /// fires — the beat the validate button used to provide.
    private func autoSubmit() async {
        defer { isProcessing = false }
        try? await Task.sleep(for: DesignTokens.Animation.pinAutoSubmitSettle)
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
            hapticStepAdvance.toggle()
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
            hapticSuccess.toggle()
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
        hapticError.toggle()

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
