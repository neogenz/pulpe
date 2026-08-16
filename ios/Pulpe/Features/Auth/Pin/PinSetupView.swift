import OSLog
import SwiftUI

// MARK: - Setup Mode

enum PinSetupMode: Equatable, Sendable {
    case chooseAndSetupRecovery
    case enterExistingPin

    var title: String {
        switch self {
        case .chooseAndSetupRecovery: AppLocale.string("Choisis ton code PIN")
        case .enterExistingPin: AppLocale.string("Saisis ton code PIN")
        }
    }

    var subtitle: String {
        switch self {
        case .chooseAndSetupRecovery:
            AppLocale.string("\(PinConstants.length) chiffres — tes montants sont chiffrés avec ce code")
        case .enterExistingPin:
            AppLocale.string("\(PinConstants.length) chiffres")
        }
    }
}

// MARK: - Setup Step

enum PinSetupStep {
    case enterPin
    case confirmPin
}

// MARK: - View

struct PinSetupView: View {
    let mode: PinSetupMode
    let onComplete: () async -> Void
    let onLogout: (() async -> Void)?

    @State private var viewModel: PinSetupViewModel

    init(
        mode: PinSetupMode = .chooseAndSetupRecovery,
        onComplete: @escaping () async -> Void,
        onLogout: (() async -> Void)?
    ) {
        self.mode = mode
        self.onComplete = onComplete
        self.onLogout = onLogout
        _viewModel = State(initialValue: PinSetupViewModel(mode: mode))
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background { Color.loginGradientBackground }
            .sensoryFeedback(.error, trigger: viewModel.hapticError)
            .sensoryFeedback(.success, trigger: viewModel.hapticSuccess)
            // Firmer than the soft key tap, and not the notification triad that
            // ends the flow — the code is noted, type it again.
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: viewModel.hapticStepAdvance)
            .sheet(item: recoveryKeySheetItemBinding) { item in
                RecoveryKeySheet(recoveryKey: item.recoveryKey) {
                    Task { await onComplete() }
                }
            }
            .onChange(of: viewModel.completedWithoutRecovery) { _, completed in
                if completed {
                    Task { await onComplete() }
                }
            }
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
            if onLogout != nil {
                logoutButton
            }
            Spacer()
            headerSection
            Spacer().frame(height: DesignTokens.Spacing.sectionGap)
            dotsSection
            Spacer().frame(height: DesignTokens.Spacing.stepHeaderTop)
            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                isDisabled: viewModel.isValidating || viewModel.isError
            )
            Spacer().frame(height: DesignTokens.Spacing.xxxl + DesignTokens.Spacing.xxl)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Logout Button

    private var logoutButton: some View {
        HStack {
            Spacer()
            Button {
                Task { await onLogout?() }
            } label: {
                Text("Se déconnecter")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
            .textLinkButtonStyle()
        }
        .padding(.top, DesignTokens.Spacing.md)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(viewModel.title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            Text(viewModel.subtitle)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
    }

    // MARK: - Dots + Error

    private var dotsSection: some View {
        PinDotsErrorView(
            enteredCount: viewModel.digits.count,
            maxDigits: viewModel.pinLength,
            isError: viewModel.isError,
            errorMessage: viewModel.errorMessage
        )
    }

    private var recoveryKeySheetItemBinding: Binding<RecoveryKeySheetItem?> {
        Binding<RecoveryKeySheetItem?>(
            get: {
                guard viewModel.showRecoverySheet, let key = viewModel.recoveryKey else { return nil }
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
final class PinSetupViewModel {
    // MARK: - Public State

    let mode: PinSetupMode
    private(set) var digits: [Int] = []
    private(set) var isValidating = false
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var recoveryKey: String?
    private(set) var completedWithoutRecovery = false
    var showRecoverySheet = false
    private(set) var currentStep: PinSetupStep = .enterPin
    private var savedDigits: [Int]?
    private(set) var hapticSuccess = false
    private(set) var hapticError = false
    private(set) var hapticStepAdvance = false

    let pinLength = PinConstants.length

    var title: String {
        if mode == .enterExistingPin { return mode.title }
        switch currentStep {
        case .enterPin: return AppLocale.string("Choisis ton code PIN")
        case .confirmPin: return AppLocale.string("Confirme ton code PIN")
        }
    }

    var subtitle: String {
        switch currentStep {
        case .enterPin: return mode.subtitle
        case .confirmPin: return AppLocale.string("Saisis à nouveau ton code")
        }
    }

    // MARK: - Private

    private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinCryptoKeyDerivation
    private let encryptionAPI: any PinEncryptionSetup
    private let clientKeyManager: any PinClientKeySetupStorage

    // MARK: - Init

    init(
        mode: PinSetupMode = .chooseAndSetupRecovery,
        cryptoService: any PinCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinEncryptionSetup = EncryptionAPI.shared,
        clientKeyManager: any PinClientKeySetupStorage = ClientKeyManager.shared
    ) {
        self.mode = mode
        self.cryptoService = cryptoService
        self.encryptionAPI = encryptionAPI
        self.clientKeyManager = clientKeyManager
    }

    // MARK: - Actions

    func appendDigit(_ digit: Int) {
        guard digits.count < pinLength, !isValidating, !isError else { return }
        digits.append(digit)

        guard digits.count == pinLength else { return }
        // Locks the numpad for the whole auto-submission, settle beat included.
        isValidating = true
        Task { await autoSubmit() }
    }

    /// Lets the last dot land on screen before the step swaps or the error
    /// fires — the beat the validate button used to provide.
    private func autoSubmit() async {
        defer { isValidating = false }
        try? await Task.sleep(for: DesignTokens.Animation.pinAutoSubmitSettle)
        await handlePinComplete()
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isValidating else { return }
        digits.removeLast()
        clearError()
    }

    // MARK: - Setup Flow

    private func handlePinComplete() async {
        guard mode == .chooseAndSetupRecovery else {
            await completeSetup()
            return
        }

        switch currentStep {
        case .enterPin:
            savedDigits = digits
            digits = []
            currentStep = .confirmPin
            hapticStepAdvance.toggle()
        case .confirmPin:
            guard digits == savedDigits else {
                showError(AppLocale.string("Les codes ne correspondent pas"))
                savedDigits = nil
                currentStep = .enterPin
                return
            }
            await completeSetup()
        }
    }

    private func completeSetup() async {
        // `isValidating` is owned by `autoSubmit()`, which spans this call.
        let pin = digits.map(String.init).joined()

        do {
            if mode == .enterExistingPin {
                _ = try await PinValidation.deriveValidateAndStore(
                    pin: pin,
                    cryptoService: cryptoService,
                    encryptionAPI: encryptionAPI,
                    clientKeyManager: clientKeyManager
                )
                completeWithSuccess(showRecovery: false)
                return
            }

            let result = try await PinValidation.derive(
                pin: pin,
                cryptoService: cryptoService,
                encryptionAPI: encryptionAPI
            )
            await clientKeyManager.store(result.clientKeyHex, enableBiometric: false)

            let key: String
            do {
                key = try await encryptionAPI.setupRecoveryKey()
            } catch {
                await clientKeyManager.clearSession()
                throw error
            }
            recoveryKey = key
            completeWithSuccess(showRecovery: true)
        } catch let apiError as APIError {
            handleAPIError(apiError)
        } catch {
            Logger.encryption.error("PIN setup failed: \(error.localizedDescription)")
            showError(AppLocale.string("Une erreur est survenue, réessaie"))
        }
    }

    // MARK: - Error Handling

    private func handleAPIError(_ error: APIError) {
        switch error {
        case .clientKeyInvalid:
            Logger.encryption.warning("PIN setup: existing key_check detected — account already has a PIN")
            showError(AppLocale.string("Un code PIN existe déjà pour ce compte — saisis-le"))
        default:
            Logger.encryption.error("PIN setup failed: \(error.localizedDescription)")
            showError(AppLocale.string("Une erreur est survenue, réessaie"))
        }
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

    private func completeWithSuccess(showRecovery: Bool) {
        digits = []
        hapticSuccess.toggle()
        AnalyticsService.shared.capture(.pinSetupCompleted)
        if showRecovery {
            showRecoverySheet = true
        } else {
            completedWithoutRecovery = true
        }
    }

    private func clearError() {
        isError = false
        errorMessage = nil
    }
}

// MARK: - Preview

#Preview {
    PinSetupView(onComplete: {}, onLogout: nil)
}
