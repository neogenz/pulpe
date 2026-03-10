import OSLog
import SwiftUI

// MARK: - Setup Mode

enum PinSetupMode: Equatable, Sendable {
    case chooseAndSetupRecovery
    case enterExistingPin

    var title: String {
        switch self {
        case .chooseAndSetupRecovery: "Choisis ton code PIN"
        case .enterExistingPin: "Saisis ton code PIN"
        }
    }

    var subtitle: String { "\(PinConstants.length) chiffres" }
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
                onConfirm: viewModel.canConfirm ? {
                    Task { await viewModel.confirm() }
                } : nil,
                isDisabled: viewModel.isValidating
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

    let pinLength = PinConstants.length

    var canConfirm: Bool {
        digits.count == pinLength && !isValidating
    }

    var title: String {
        if mode == .enterExistingPin { return mode.title }
        switch currentStep {
        case .enterPin: return "Choisis ton code PIN"
        case .confirmPin: return "Confirme ton code PIN"
        }
    }

    var subtitle: String {
        switch currentStep {
        case .enterPin: return "\(PinConstants.length) chiffres"
        case .confirmPin: return "Saisis à nouveau ton code"
        }
    }

    // MARK: - Private

    private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinCryptoKeyDerivation
    private let encryptionAPI: any PinEncryptionSetup
    private let clientKeyManager: any PinClientKeyStorage

    // MARK: - Init

    init(
        mode: PinSetupMode = .chooseAndSetupRecovery,
        cryptoService: any PinCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinEncryptionSetup = EncryptionAPI.shared,
        clientKeyManager: any PinClientKeyStorage = ClientKeyManager.shared
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
    }

    func confirm() async {
        guard canConfirm else { return }
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
        case .confirmPin:
            guard digits == savedDigits else {
                showError("Les codes ne correspondent pas")
                savedDigits = nil
                currentStep = .enterPin
                return
            }
            await completeSetup()
        }
    }

    private func completeSetup() async {
        isValidating = true
        defer { isValidating = false }

        let pin = digits.map(String.init).joined()

        do {
            let result = try await PinValidation.deriveValidateAndStore(
                pin: pin,
                cryptoService: cryptoService,
                encryptionAPI: encryptionAPI,
                clientKeyManager: clientKeyManager
            )

            // For existing PIN mode, skip recovery key setup
            if mode == .enterExistingPin {
                completeWithSuccess(showRecovery: false)
                return
            }

            // Skip recovery setup if user already has one (edge case: vault-status 404)
            guard !result.saltResponse.hasRecoveryKey else {
                Logger.encryption.info("Skipping recovery key setup — user already has one")
                completeWithSuccess(showRecovery: false)
                return
            }

            let key = try await encryptionAPI.setupRecoveryKey()
            recoveryKey = key
            completeWithSuccess(showRecovery: true)
        } catch let apiError as APIError {
            handleAPIError(apiError)
        } catch {
            Logger.encryption.error("PIN setup failed: \(error.localizedDescription)")
            showError("Une erreur est survenue, réessaie")
        }
    }

    // MARK: - Error Handling

    private func handleAPIError(_ error: APIError) {
        switch error {
        case .clientKeyInvalid:
            Logger.encryption.warning("PIN setup: existing key_check detected — account already has a PIN")
            showError("Un code PIN existe déjà pour ce compte — saisis-le")
        default:
            Logger.encryption.error("PIN setup failed: \(error.localizedDescription)")
            showError("Une erreur est survenue, réessaie")
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
