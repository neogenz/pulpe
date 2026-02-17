import SwiftUI

struct ResetPasswordFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ResetPasswordFlowViewModel()
    @State private var hasPerformedCancelCleanup = false
    @FocusState private var focusedField: Field?

    let callbackURL: URL
    let onComplete: () async -> Void
    let onCancel: () async -> Void

    private enum Field: Hashable {
        case recoveryKey
        case newPassword
        case confirmPassword
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isPreparing {
                    loadingState
                } else if let invalidMessage = viewModel.invalidLinkMessage {
                    invalidState(message: invalidMessage)
                } else if let securityMessage = viewModel.securityContextLoadFailureMessage {
                    securityContextLoadFailureState(message: securityMessage)
                } else {
                    formState
                }
            }
            .padding(DesignTokens.Spacing.xl)
            .background(Color.surfacePrimary)
            .navigationTitle("Réinitialiser le mot de passe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") {
                        handleCloseAction()
                    }
                }
            }
        }
        .sheet(isPresented: $viewModel.showRecoveryKeySheet) {
            if let recoveryKey = viewModel.generatedRecoveryKey {
                RecoveryKeySheet(recoveryKey: recoveryKey) {
                    viewModel.acknowledgeRecoveryKeySaved()
                    Task { await finishFlow() }
                }
            }
        }
        .task {
            await viewModel.prepare(with: callbackURL)
        }
        .onDisappear {
            guard !hasPerformedCancelCleanup,
                  !viewModel.isCompleted,
                  viewModel.shouldCleanupOnDismiss else { return }
            hasPerformedCancelCleanup = true
            Task {
                await onCancel()
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            ProgressView()
                .tint(Color.pulpePrimary)
            Text("Vérification du lien...")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func invalidState(message: String) -> some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Image(systemName: "link.badge.plus")
                .font(.system(size: 48))
                .foregroundStyle(Color.errorPrimary)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Lien invalide ou expiré")
                    .font(PulpeTypography.onboardingTitle)
                Text(message)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
            }

            Button("Retour à la connexion") {
                handleCloseAction()
            }
            .primaryButtonStyle()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func securityContextLoadFailureState(message: String) -> some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundStyle(Color.errorPrimary)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Erreur de chargement sécurité")
                    .font(PulpeTypography.onboardingTitle)
                Text(message)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
            }

            Button("Réessayer") {
                Task {
                    await viewModel.retrySecurityContextLoad()
                }
            }
            .primaryButtonStyle()

            Button("Retour à la connexion") {
                handleCloseAction()
            }
            .secondaryButtonStyle()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var formState: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Définis ton nouveau mot de passe.")
                    .font(PulpeTypography.bodyLarge)
                    .multilineTextAlignment(.center)

                if viewModel.requiresRecoveryKey {
                    Text("Entre aussi ta clé de secours pour restaurer l'accès au coffre.")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                }
            }

            if viewModel.requiresRecoveryKey {
                recoveryKeyField
            }

            newPasswordField
            confirmPasswordField

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.errorPrimary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }

            Spacer()

            if viewModel.needsRecoveryKeyGenerationRetry {
                Button {
                    Task {
                        await viewModel.retryRecoveryKeyGeneration()
                    }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        if viewModel.isSubmitting {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(viewModel.isSubmitting ? "Nouvelle tentative..." : "Réessayer la génération de clé")
                            .font(PulpeTypography.buttonLabel)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.onboardingGradient)
                    .foregroundStyle(Color.textOnPrimary)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                }
                .disabled(viewModel.isSubmitting)
            } else {
                Button {
                    Task {
                        await viewModel.submit()
                        if viewModel.isCompleted {
                            await finishFlow()
                        }
                    }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        if viewModel.isSubmitting {
                            ProgressView()
                                .tint(.white)
                        }
                        Text(viewModel.isSubmitting ? "Réinitialisation..." : "Valider")
                            .font(PulpeTypography.buttonLabel)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background {
                        if viewModel.canSubmit {
                            Color.onboardingGradient
                        } else {
                            Color.surfaceCard
                        }
                    }
                    .foregroundStyle(viewModel.canSubmit ? Color.textOnPrimary : Color.textSecondaryOnboarding)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                }
                .disabled(!viewModel.canSubmit)
            }
        }
    }

    private var recoveryKeyField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Clé de secours")
                .font(PulpeTypography.labelLarge)

            TextField(
                "XXXX-XXXX-XXXX-XXXX-...",
                text: Binding(
                    get: { viewModel.recoveryKeyInput },
                    set: { viewModel.updateRecoveryKey($0) }
                )
            )
            .font(.system(.body, design: .monospaced))
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .textContentType(.oneTimeCode)
            .privacySensitive()
            .focused($focusedField, equals: .recoveryKey)
            .padding()
            .background(Color.pinInputBackground)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                    .strokeBorder(Color.pinInputBorder, lineWidth: 1)
            }
        }
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau mot de passe")
                .font(PulpeTypography.labelLarge)

            SecureField("8 caractères minimum", text: $viewModel.newPassword)
                .focused($focusedField, equals: .newPassword)
                .textContentType(.newPassword)
                .padding()
                .background(Color.surfaceCard)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
                }
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le mot de passe")
                .font(PulpeTypography.labelLarge)

            SecureField("Confirme ton nouveau mot de passe", text: $viewModel.confirmPassword)
                .focused($focusedField, equals: .confirmPassword)
                .textContentType(.newPassword)
                .padding()
                .background(Color.surfaceCard)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
                }
        }
    }

    private func finishFlow() async {
        hasPerformedCancelCleanup = true
        await onComplete()
        dismiss()
    }

    private func handleCloseAction() {
        Task {
            await cancelAndDismiss()
        }
    }

    private func cancelAndDismiss() async {
        if hasPerformedCancelCleanup {
            dismiss()
            return
        }

        hasPerformedCancelCleanup = true
        if viewModel.shouldCleanupOnDismiss {
            await onCancel()
        }
        dismiss()
    }
}

enum ResetPreparationError: Equatable {
    case invalidLink(String)
    case securityContextLoadFailure(String)
}

@Observable @MainActor
final class ResetPasswordFlowViewModel {
    var isPreparing = true
    var isSubmitting = false
    var preparationError: ResetPreparationError?
    var errorMessage: String?
    var newPassword = ""
    var confirmPassword = ""
    var recoveryKeyInput = ""
    var showRecoveryKeySheet = false
    var generatedRecoveryKey: String?
    var needsRecoveryKeyGenerationRetry = false
    var shouldCleanupOnDismiss = false
    var isCompleted = false

    private var context: PasswordRecoveryContext?
    private var saltInfo: EncryptionSaltResponse?
    private var strippedRecoveryKey = ""
    private var hasRecoveredEncryption = false
    private let dependencies: ResetPasswordDependencies

    init(dependencies: ResetPasswordDependencies? = nil) {
        self.dependencies = dependencies ?? .live
    }

    var invalidLinkMessage: String? {
        guard case .invalidLink(let message) = preparationError else { return nil }
        return message
    }

    var securityContextLoadFailureMessage: String? {
        guard case .securityContextLoadFailure(let message) = preparationError else { return nil }
        return message
    }

    var hasVaultCodeConfigured: Bool {
        context?.hasVaultCodeConfigured ?? false
    }

    var hasRecoveryKey: Bool {
        saltInfo?.hasRecoveryKey ?? false
    }

    var requiresRecoveryKey: Bool {
        !hasVaultCodeConfigured && hasRecoveryKey
    }

    var isNewPasswordValid: Bool {
        newPassword.count >= 8
    }

    var isPasswordConfirmed: Bool {
        !confirmPassword.isEmpty && newPassword == confirmPassword
    }

    var isRecoveryKeyValid: Bool {
        strippedRecoveryKey.count == 52
    }

    var canSubmit: Bool {
        let baseValid = !isPreparing
            && !isSubmitting
            && isNewPasswordValid
            && isPasswordConfirmed
            && !needsRecoveryKeyGenerationRetry
        if requiresRecoveryKey {
            return baseValid && isRecoveryKeyValid
        }
        return baseValid
    }

    func prepare(with callbackURL: URL) async {
        isPreparing = true
        preparationError = nil
        errorMessage = nil
        needsRecoveryKeyGenerationRetry = false

        defer { isPreparing = false }

        do {
            let recoveredContext = try await dependencies.beginPasswordRecovery(callbackURL)
            context = recoveredContext
            shouldCleanupOnDismiss = true
        } catch {
            preparationError = .invalidLink(
                "Ce lien n'est plus valide. Demande un nouveau lien depuis l'écran de connexion."
            )
            shouldCleanupOnDismiss = false
            return
        }

        do {
            let salt = try await dependencies.getSalt()
            saltInfo = salt
        } catch {
            preparationError = .securityContextLoadFailure(
                "Impossible de charger les informations de sécurité. Vérifie ta connexion et réessaie."
            )
        }
    }

    func retrySecurityContextLoad() async {
        guard context != nil else { return }

        isPreparing = true
        errorMessage = nil
        preparationError = nil

        defer { isPreparing = false }

        do {
            let salt = try await dependencies.getSalt()
            saltInfo = salt
        } catch {
            preparationError = .securityContextLoadFailure(
                "Impossible de charger les informations de sécurité. Vérifie ta connexion et réessaie."
            )
        }
    }

    func updateRecoveryKey(_ input: String) {
        recoveryKeyInput = RecoveryKeyFormatter.format(input)
        strippedRecoveryKey = RecoveryKeyFormatter.strip(recoveryKeyInput)
        errorMessage = nil
    }

    func submit() async {
        if needsRecoveryKeyGenerationRetry {
            await retryRecoveryKeyGeneration()
            return
        }

        guard canSubmit else {
            if !isNewPasswordValid {
                errorMessage = "8 caractères minimum"
            } else if !isPasswordConfirmed {
                errorMessage = "Les mots de passe ne correspondent pas"
            } else if requiresRecoveryKey && !isRecoveryKeyValid {
                errorMessage = "Clé de secours invalide"
            }
            return
        }

        guard let saltInfo else {
            errorMessage = "Impossible de charger les informations de sécurité"
            return
        }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            if hasVaultCodeConfigured {
                try await dependencies.updatePassword(newPassword)
                markCompleted()
                return
            }

            if hasRecoveryKey {
                let newClientKey = try await dependencies.deriveClientKey(
                    newPassword,
                    saltInfo.salt,
                    saltInfo.kdfIterations
                )

                try await dependencies.updatePassword(newPassword)
                try await dependencies.recoverEncryption(
                    strippedRecoveryKey,
                    newClientKey
                )
                await dependencies.storeClientKey(newClientKey)
                hasRecoveredEncryption = true

                do {
                    try await generateRecoveryKey()
                } catch {
                    needsRecoveryKeyGenerationRetry = true
                    errorMessage = "La récupération est terminée, mais la nouvelle clé de secours n'a pas pu être générée. Réessaie."
                }
                return
            }

            try await dependencies.updatePassword(newPassword)
            markCompleted()
        } catch let apiError as APIError {
            handleAPIError(apiError)
        } catch {
            errorMessage = "Quelque chose n'a pas fonctionné — réessaie"
        }
    }

    func retryRecoveryKeyGeneration() async {
        guard hasRecoveredEncryption else { return }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            try await generateRecoveryKey()
            needsRecoveryKeyGenerationRetry = false
        } catch {
            needsRecoveryKeyGenerationRetry = true
            errorMessage = "Impossible de générer la nouvelle clé de secours. Réessaie."
        }
    }

    func acknowledgeRecoveryKeySaved() {
        showRecoveryKeySheet = false
        markCompleted()
    }

    private func handleAPIError(_ error: APIError) {
        switch error {
        case .validationError:
            errorMessage = "Clé de secours invalide — vérifie que tu as bien copié la clé"
        case .rateLimited:
            errorMessage = "Trop de tentatives — patiente un moment"
        case .networkError:
            errorMessage = "Connexion impossible — vérifie ta connexion internet"
        default:
            errorMessage = error.localizedDescription
        }
    }

    private func generateRecoveryKey() async throws {
        let recoveryKey = try await dependencies.setupRecoveryKey()
        generatedRecoveryKey = recoveryKey
        showRecoveryKeySheet = true
    }

    private func markCompleted() {
        isCompleted = true
        shouldCleanupOnDismiss = false
        needsRecoveryKeyGenerationRetry = false
        hasRecoveredEncryption = false
    }
}

struct ResetPasswordDependencies: Sendable {
    var beginPasswordRecovery: @Sendable (URL) async throws -> PasswordRecoveryContext
    var getSalt: @Sendable () async throws -> EncryptionSaltResponse
    var updatePassword: @Sendable (String) async throws -> Void
    var recoverEncryption: @Sendable (String, String) async throws -> Void
    var setupRecoveryKey: @Sendable () async throws -> String
    var deriveClientKey: @Sendable (String, String, Int) async throws -> String
    var storeClientKey: @Sendable (String) async -> Void

    static var live: ResetPasswordDependencies {
        ResetPasswordDependencies(
        beginPasswordRecovery: { callbackURL in
            try await AuthService.shared.beginPasswordRecovery(from: callbackURL)
        },
        getSalt: {
            try await EncryptionAPI.shared.getSalt()
        },
        updatePassword: { password in
            try await AuthService.shared.updatePassword(password)
        },
        recoverEncryption: { recoveryKey, newClientKeyHex in
            try await EncryptionAPI.shared.recover(
                recoveryKey: recoveryKey,
                newClientKeyHex: newClientKeyHex
            )
        },
        setupRecoveryKey: {
            try await EncryptionAPI.shared.setupRecoveryKey()
        },
        deriveClientKey: { password, saltHex, iterations in
            try await Task.detached {
                try await CryptoService.shared.deriveClientKey(
                    pin: password,
                    saltHex: saltHex,
                    iterations: iterations
                )
            }.value
        },
        storeClientKey: { clientKeyHex in
            await ClientKeyManager.shared.store(clientKeyHex, enableBiometric: false)
        }
        )
    }
}

#Preview {
    ResetPasswordFlowView(
        callbackURL: URL(string: "pulpe://reset-password#access_token=token&refresh_token=refresh&type=recovery")!,
        onComplete: {},
        onCancel: {}
    )
}
