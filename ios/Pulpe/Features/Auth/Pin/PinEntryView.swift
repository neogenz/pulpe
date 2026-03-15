import OSLog
import SwiftUI

// MARK: - View

struct PinEntryView: View {
    static let pinEntryTitle = "Saisis ton code PIN"
    static let forgotPinLabel = "Code PIN oublié ?"

    let firstName: String
    let onSuccess: () -> Void
    var onBiometric: (() -> Void)?
    let onForgotPin: () -> Void
    let onLogout: () async -> Void

    @State private var viewModel = PinEntryViewModel()
    @State private var hasTriggeredAutoBiometric = false

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .sensoryFeedback(.error, trigger: viewModel.hapticError)
            .sensoryFeedback(.success, trigger: viewModel.hapticSuccess)
            .onChange(of: viewModel.authenticated) { _, authenticated in
                if authenticated { onSuccess() }
            }
            .onAppear {
                triggerAutoBiometricIfNeeded()
            }
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
            logoutButton
            Spacer()
            headerSection
            Spacer().frame(height: DesignTokens.Spacing.sectionGap)
            dotsSection
            Spacer().frame(height: DesignTokens.Spacing.stepHeaderTop)
            NumpadView(
                onDigit: { viewModel.appendDigit($0) },
                onDelete: { viewModel.deleteLastDigit() },
                onBiometric: onBiometric,
                isDisabled: viewModel.isValidating || viewModel.isError
            )
            Spacer().frame(height: 24)
            forgotPinLink
            Spacer().frame(height: 16)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Logout Button

    private var logoutButton: some View {
        HStack {
            Spacer()
            Button {
                Task { await onLogout() }
            } label: {
                Text("Se déconnecter")
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
        }
        .padding(.top, DesignTokens.Spacing.md)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            PulpeIcon(size: 56)

            Text(Self.pinEntryTitle)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            if !firstName.isEmpty {
                Text("Bonjour, \(firstName)")
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
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

    // MARK: - Forgot PIN

    private var forgotPinLink: some View {
        Button {
            onForgotPin()
        } label: {
            Text(Self.forgotPinLabel)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
    }

    private func triggerAutoBiometricIfNeeded() {
        guard !hasTriggeredAutoBiometric else { return }
        guard onBiometric != nil else { return }

        hasTriggeredAutoBiometric = true
        onBiometric?()
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class PinEntryViewModel {
    // MARK: - Public State

    private(set) var digits: [Int] = []
    private(set) var isValidating = false
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var authenticated = false
    private(set) var hapticSuccess = false
    private(set) var hapticError = false

    let pinLength = PinConstants.length

    // MARK: - Private

    private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinCryptoKeyDerivation
    private let encryptionAPI: any PinEncryptionValidation
    private let clientKeyManager: any PinClientKeyStorage

    // MARK: - Init

    init(
        cryptoService: any PinCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinEncryptionValidation = EncryptionAPI.shared,
        clientKeyManager: any PinClientKeyStorage = ClientKeyManager.shared
    ) {
        self.cryptoService = cryptoService
        self.encryptionAPI = encryptionAPI
        self.clientKeyManager = clientKeyManager
    }

    // MARK: - Actions

    func appendDigit(_ digit: Int) {
        guard digits.count < pinLength, !isValidating, !isError else { return }
        digits.append(digit)

        if digits.count == pinLength {
            isValidating = true
            Task { await validatePin() }
        }
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isValidating else { return }
        digits.removeLast()
        clearError()
    }

    // MARK: - Validation

    private func validatePin() async {
        defer { isValidating = false }

        let pin = digits.map(String.init).joined()

        do {
            _ = try await PinValidation.deriveValidateAndStore(
                pin: pin,
                cryptoService: cryptoService,
                encryptionAPI: encryptionAPI,
                clientKeyManager: clientKeyManager
            )

            digits = []
            hapticSuccess.toggle()
            AnalyticsService.shared.capture(.pinEntered)
            authenticated = true
        } catch let error as APIError {
            handleAPIError(error)
        } catch let error as CryptoServiceError {
            handleCryptoError(error)
        } catch {
            showError("Erreur inattendue, réessaie")
        }
    }

    // MARK: - Error Handling

    private func handleAPIError(_ error: APIError) {
        showError(error.pinValidationMessage)
    }

    private func handleCryptoError(_ error: CryptoServiceError) {
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

    private func clearError() {
        isError = false
        errorMessage = nil
    }
}

// MARK: - Preview

#Preview {
    PinEntryView(
        firstName: "Maxime",
        onSuccess: {},
        onForgotPin: {},
        onLogout: {}
    )
}
