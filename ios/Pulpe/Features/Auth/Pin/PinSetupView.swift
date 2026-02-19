import OSLog
import SwiftUI

enum PinSetupMode: Equatable, Sendable {
    case chooseAndSetupRecovery
    case enterExistingPin

    var title: String {
        switch self {
        case .chooseAndSetupRecovery:
            return "Choisis ton code PIN"
        case .enterExistingPin:
            return "Saisis ton code PIN"
        }
    }

    var subtitle: String {
        "4 chiffres minimum"
    }
}

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
            .pulpeBackground()
            .sheet(isPresented: $viewModel.showRecoverySheet) {
            if let key = viewModel.recoveryKey {
                RecoveryKeySheet(recoveryKey: key) {
                    Task {
                        await onComplete()
                    }
                }
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

    // MARK: - Logout Button

    private var logoutButton: some View {
        HStack {
            Spacer()
            Button {
                Task {
                    await onLogout?()
                }
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
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(viewModel.mode.title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            Text(viewModel.mode.subtitle)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
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
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.errorPrimary)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.errorMessage)
    }

    // MARK: - Back Button

    @ViewBuilder
    private var backButton: some View {
        Color.clear.frame(height: 20)
    }
}

// MARK: - ViewModel

protocol PinSetupCryptoKeyDerivation: Sendable {
    func deriveClientKey(pin: String, saltHex: String, iterations: Int) async throws -> String
}

protocol PinSetupEncryptionKeyValidation: Sendable {
    func getSalt() async throws -> EncryptionSaltResponse
    func validateKey(_ clientKeyHex: String) async throws
    func setupRecoveryKey() async throws -> String
}

protocol PinSetupClientKeyStorage: Sendable {
    func store(_ clientKeyHex: String, enableBiometric: Bool) async
}

extension CryptoService: PinSetupCryptoKeyDerivation {}
extension EncryptionAPI: PinSetupEncryptionKeyValidation {}
extension ClientKeyManager: PinSetupClientKeyStorage {}

@Observable @MainActor
final class PinSetupViewModel {
    let mode: PinSetupMode

    private(set) var digits: [Int] = []
    private(set) var isValidating = false
    private(set) var isError = false
    private(set) var errorMessage: String?
    private(set) var recoveryKey: String?
    private(set) var completedWithoutRecovery = false
    var showRecoverySheet = false

    let maxDigits = 6
    let minDigits = 4

    private var errorResetTask: Task<Void, Never>?
    private let cryptoService: any PinSetupCryptoKeyDerivation
    private let encryptionAPI: any PinSetupEncryptionKeyValidation
    private let clientKeyManager: any PinSetupClientKeyStorage

    init(
        mode: PinSetupMode = .chooseAndSetupRecovery,
        cryptoService: any PinSetupCryptoKeyDerivation = CryptoService.shared,
        encryptionAPI: any PinSetupEncryptionKeyValidation = EncryptionAPI.shared,
        clientKeyManager: any PinSetupClientKeyStorage = ClientKeyManager.shared
    ) {
        self.mode = mode
        self.cryptoService = cryptoService
        self.encryptionAPI = encryptionAPI
        self.clientKeyManager = clientKeyManager
    }

    var canConfirm: Bool {
        digits.count >= minDigits && !isValidating
    }

    func appendDigit(_ digit: Int) {
        guard digits.count < maxDigits, !isValidating else { return }
        digits.append(digit)

        if digits.count == maxDigits {
            Task { await completeSetup() }
        }
    }

    func confirm() async {
        guard canConfirm else { return }
        await completeSetup()
    }

    func deleteLastDigit() {
        guard !digits.isEmpty, !isValidating else { return }
        digits.removeLast()
        isError = false
        errorMessage = nil
    }

    // MARK: - Private

    private var pinString: String {
        digits.map(String.init).joined()
    }

    private func completeSetup() async {
        isValidating = true
        defer { isValidating = false }

        let pin = pinString

        do {
            let saltResponse = try await encryptionAPI.getSalt()
            let clientKeyHex = try await cryptoService.deriveClientKey(
                pin: pin,
                saltHex: saltResponse.salt,
                iterations: saltResponse.kdfIterations
            )
            try await encryptionAPI.validateKey(clientKeyHex)
            await clientKeyManager.store(clientKeyHex, enableBiometric: false)

            if mode == .enterExistingPin {
                digits = []
                completedWithoutRecovery = true
                return
            }

            // Guard: if user already has a recovery key, skip setup to avoid overwriting it.
            // This can happen when vault-status returns 404 and the app routes here by mistake.
            guard !saltResponse.hasRecoveryKey else {
                Logger.encryption.info("Skipping recovery key setup — user already has one")
                digits = []
                completedWithoutRecovery = true
                return
            }

            let key = try await encryptionAPI.setupRecoveryKey()
            recoveryKey = key
            digits = []
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

        errorResetTask?.cancel()
        errorResetTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            isError = false
        }
    }
}

#Preview {
    PinSetupView(onComplete: {}, onLogout: nil)
}
