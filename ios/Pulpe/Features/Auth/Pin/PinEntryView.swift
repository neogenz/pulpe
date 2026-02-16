import OSLog
import SwiftUI

struct PinEntryView: View {
    let firstName: String
    let onSuccess: () -> Void
    let onForgotPin: () -> Void
    let onLogout: () async -> Void

    @State private var viewModel = PinEntryViewModel()

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .pulpeBackground()
            .task {
                await viewModel.checkBiometricAvailability()
                if viewModel.biometricAvailable {
                    await viewModel.attemptBiometric()
                    if viewModel.authenticated {
                        onSuccess()
                    }
                }
            }
            .onChange(of: viewModel.authenticated) { _, authenticated in
                if authenticated { onSuccess() }
            }
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
            logoutButton
            Spacer()
            headerSection
            Spacer().frame(height: 40)
            dotsSection
            Spacer().frame(height: 48)
            NumpadView(
                onDigit: { digit in
                    viewModel.appendDigit(digit)
                },
                onDelete: { viewModel.deleteLastDigit() },
                onBiometric: viewModel.biometricAvailable && viewModel.digits.count < viewModel.minDigits ? {
                    Task { await viewModel.attemptBiometric() }
                } : nil,
                onConfirm: viewModel.digits.count >= viewModel.minDigits ? {
                    Task { await viewModel.confirm() }
                } : nil,
                isDisabled: viewModel.isValidating
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
                Task {
                    await onLogout()
                }
            } label: {
                Text("Se déconnecter")
                    .font(.footnote)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }
        }
        .padding(.top, DesignTokens.Spacing.md)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            PulpeIcon(size: 56)

            Text("Bonjour, \(firstName)")
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)
        }
    }

    // MARK: - Dots + Error

    private var dotsSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            PinDotsView(
                enteredCount: viewModel.digits.count,
                maxDigits: viewModel.maxDigits,
                isError: viewModel.isError
            )

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.errorMessage)
    }

    // MARK: - Forgot PIN

    private var forgotPinLink: some View {
        Button {
            onForgotPin()
        } label: {
            Text("Code d'accès oublié ?")
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class PinEntryViewModel {
    private(set) var digits: [Int] = []
    private(set) var isValidating = false
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var biometricAvailable = false
    private(set) var authenticated = false

    let maxDigits = 6
    let minDigits = 4

    private let cryptoService = CryptoService.shared
    private let encryptionAPI = EncryptionAPI.shared
    private let clientKeyManager = ClientKeyManager.shared

    var canConfirm: Bool {
        digits.count >= minDigits && !isValidating
    }

    func appendDigit(_ digit: Int) {
        guard digits.count < maxDigits, !isValidating else { return }
        digits.append(digit)
        
        // Let user review their full PIN before validation
        // Consistent with PIN setup flow which requires explicit confirmation
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isValidating else { return }
        digits.removeLast()
        isError = false
        errorMessage = nil
    }

    func confirm() async {
        guard canConfirm else { return }
        await validatePin()
    }

    func attemptBiometric() async {
        do {
            let key = try await clientKeyManager.resolveViaBiometric()
            if key != nil {
                authenticated = true
            }
        } catch {
            Logger.encryption.debug("Biometric unlock failed: \(error.localizedDescription)")
        }
    }

    func checkBiometricAvailability() async {
        let canUse = BiometricService.shared.canUseBiometrics()
        let hasKey = await clientKeyManager.hasBiometricKey()
        biometricAvailable = canUse && hasKey
    }

    // MARK: - Private

    private func validatePin() async {
        isValidating = true
        defer { isValidating = false }

        let pin = digits.map(String.init).joined()

        do {
            let saltResponse = try await encryptionAPI.getSalt()
            let clientKeyHex = try await cryptoService.deriveClientKey(
                pin: pin,
                saltHex: saltResponse.salt,
                iterations: saltResponse.kdfIterations
            )
            try await encryptionAPI.validateKey(clientKeyHex)
            await clientKeyManager.store(clientKeyHex, enableBiometric: false)
            authenticated = true
        } catch let error as APIError {
            handleError(error)
        } catch {
            showError("Erreur inattendue, reessaie")
        }
    }

    private func handleError(_ error: APIError) {
        switch error {
        case .rateLimited:
            showError("Trop de tentatives, patiente un moment")
        case .networkError:
            showError("Erreur de connexion, reessaie")
        default:
            showError("Ce code ne semble pas correct")
        }
    }

    private func showError(_ message: String) {
        errorMessage = message
        isError = true
        digits = []

        Task {
            try? await Task.sleep(for: .seconds(1))
            isError = false
        }
    }
}

#Preview {
    PinEntryView(
        firstName: "Maxime",
        onSuccess: {},
        onForgotPin: {},
        onLogout: {}
    )
}
