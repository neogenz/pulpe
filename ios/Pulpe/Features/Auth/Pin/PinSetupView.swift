import OSLog
import SwiftUI

struct PinSetupView: View {
    let onComplete: () -> Void

    @State private var viewModel = PinSetupViewModel()

    var body: some View {
        ZStack {
            background
            content
        }
        .sheet(isPresented: $viewModel.showRecoverySheet) {
            if let key = viewModel.recoveryKey {
                RecoveryKeySheet(recoveryKey: key) {
                    onComplete()
                }
            }
        }
    }

    // MARK: - Background

    private var background: some View {
        Color.pinBackground
            .ignoresSafeArea()
    }

    // MARK: - Content

    private var content: some View {
        VStack(spacing: 0) {
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
                onConfirm: viewModel.canConfirm ? {
                    Task { await viewModel.confirm() }
                } : nil,
                isDisabled: viewModel.isValidating
            )
            Spacer().frame(height: 24)
            backButton
            Spacer().frame(height: 16)
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(viewModel.step == .create ? "Choisis ton code PIN" : "Confirme ton code PIN")
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.pinText)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.step)

            if viewModel.step == .create {
                Text("4 chiffres minimum")
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.pinTextSecondary)
            }
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

    // MARK: - Back Button

    @ViewBuilder
    private var backButton: some View {
        if viewModel.step == .confirm {
            Button {
                viewModel.goBack()
            } label: {
                Text("Revenir")
                    .font(PulpeTypography.stepSubtitle)
                    .foregroundStyle(Color.pinTextSecondary)
            }
        } else {
            Color.clear.frame(height: 20)
        }
    }
}

// MARK: - Step

enum PinSetupStep {
    case create
    case confirm
}

// MARK: - ViewModel

@Observable @MainActor
final class PinSetupViewModel {
    private(set) var step: PinSetupStep = .create
    private(set) var digits: [Int] = []
    private(set) var isValidating = false
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var recoveryKey: String?
    var showRecoverySheet = false

    let maxDigits = 6
    let minDigits = 4

    private var firstPin: String?
    private let cryptoService = CryptoService.shared
    private let encryptionAPI = EncryptionAPI.shared
    private let clientKeyManager = ClientKeyManager.shared
    private let authService = AuthService.shared

    var canConfirm: Bool {
        digits.count >= minDigits && !isValidating
    }

    func appendDigit(_ digit: Int) {
        guard digits.count < maxDigits, !isValidating else { return }
        digits.append(digit)

        if digits.count == maxDigits {
            Task { await handleStepComplete() }
        }
    }

    func confirm() async {
        guard canConfirm else { return }
        await handleStepComplete()
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isValidating else { return }
        digits.removeLast()
        isError = false
        errorMessage = nil
    }

    func goBack() {
        step = .create
        digits = []
        firstPin = nil
        isError = false
        errorMessage = nil
    }

    // MARK: - Private

    private var pinString: String {
        digits.map(String.init).joined()
    }

    private func handleStepComplete() async {
        switch step {
        case .create:
            firstPin = pinString
            step = .confirm
            digits = []
        case .confirm:
            if pinString == firstPin {
                await completeSetup()
            } else {
                showError("Les codes ne correspondent pas")
            }
        }
    }

    private func completeSetup() async {
        isValidating = true
        defer { isValidating = false }

        guard let pin = firstPin else { return }

        do {
            let saltResponse = try await encryptionAPI.getSalt()
            let clientKeyHex = try await cryptoService.deriveClientKey(
                pin: pin,
                saltHex: saltResponse.salt,
                iterations: saltResponse.kdfIterations
            )
            try await encryptionAPI.validateKey(clientKeyHex)
            await clientKeyManager.store(clientKeyHex, enableBiometric: false)

            let key = try await encryptionAPI.setupRecoveryKey()
            recoveryKey = key

            try await authService.markVaultCodeConfigured()

            showRecoverySheet = true
        } catch {
            Logger.encryption.error("PIN setup failed: \(error.localizedDescription)")
            showError("Une erreur est survenue, reessaie")
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
    PinSetupView(onComplete: {})
}
