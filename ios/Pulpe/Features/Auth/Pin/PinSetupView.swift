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
            AppLocale.string(
                """
                    \(PinConstants.length) chiffres. Ce code protège tes montants, \
                    et je ne le connais pas : choisis-en un dont tu te souviendras.
                    """
            )
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
            .background { Color.appBackground.ignoresSafeArea() }
            .sensoryFeedback(.error, trigger: viewModel.hapticError)
            .sensoryFeedback(.success, trigger: viewModel.hapticSuccess)
            // Firmer than the soft key tap, and not the notification triad that
            // ends the flow — the code is noted, type it again.
            .sensoryFeedback(.impact(flexibility: .rigid), trigger: viewModel.hapticStepAdvance)
            .sheet(item: recoveryKeySheetItemBinding) { item in
                RecoveryKeySheet(recoveryKey: item.recoveryKey) {
                    AnalyticsService.shared.capture(.recoveryKeyAcknowledged)
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
                // The open iPhone Duo would run the subtitle on one 700 pt line.
                .frame(maxWidth: DesignTokens.Entry.columnMaxWidth)
            // The gaps give way on a short screen (the open Duo) so the subtitle keeps both lines.
            Spacer(minLength: DesignTokens.Spacing.lg).frame(maxHeight: DesignTokens.Spacing.sectionGap)
            dotsSection
            Spacer(minLength: DesignTokens.Spacing.lg).frame(maxHeight: DesignTokens.Spacing.stepHeaderTop)
            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                isDisabled: viewModel.isValidating || viewModel.isError
            )
            Spacer().frame(height: DesignTokens.Spacing.xl)
            // One height for every step's footer: the keypad must not move under the thumb
            // between « Choisis » and « Confirme ».
            footer
                .frame(minHeight: DesignTokens.TapTarget.minimum)
            Spacer().frame(height: DesignTokens.Spacing.xl)
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
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
            }
            .textLinkButtonStyle()
        }
        .padding(.top, DesignTokens.Spacing.md)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            if let eyebrow = viewModel.eyebrow {
                Text(eyebrow)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.accentInk)
            }

            Text(viewModel.title)
                .font(PulpeTypography.entryTitle)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)

            Text(viewModel.subtitle)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// What comes next on the first step; the way back on the second.
    @ViewBuilder
    private var footer: some View {
        switch viewModel.currentStep {
        case .enterPin where viewModel.mode == .chooseAndSetupRecovery:
            Text("Ensuite, je te donne ta clé de récupération.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
        case .confirmPin:
            Button("Revenir à l'étape 1") { viewModel.backToFirstStep() }
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.pulpePrimary)
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .disabled(viewModel.isValidating)
        case .enterPin:
            EmptyView()
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
        case .confirmPin: return AppLocale.string("Confirme ton code")
        }
    }

    /// "Étape 1 sur 2": only the choose-and-confirm ceremony has steps.
    var eyebrow: String? {
        guard mode == .chooseAndSetupRecovery else { return nil }
        switch currentStep {
        case .enterPin: return AppLocale.string("Étape 1 sur 2")
        case .confirmPin: return AppLocale.string("Étape 2 sur 2")
        }
    }

    var subtitle: String {
        switch currentStep {
        case .enterPin: return mode.subtitle
        case .confirmPin: return AppLocale.string("Saisis-le une deuxième fois.")
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

    /// Back from the confirmation to choosing the code again.
    func backToFirstStep() {
        guard currentStep == .confirmPin, !isValidating else { return }
        savedDigits = nil
        digits = []
        currentStep = .enterPin
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
