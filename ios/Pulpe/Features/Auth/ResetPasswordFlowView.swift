import SwiftUI

struct ResetPasswordFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ResetPasswordFlowViewModel()
    @State private var hasPerformedCancelCleanup = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false
    @FocusState private var focusedField: Field?

    let callbackURL: URL
    let onComplete: () async -> Void
    let onCancel: () async -> Void

    private enum Field: Hashable {
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
                } else {
                    formState
                }
            }
            .padding(DesignTokens.Spacing.xl)
            .background(Color.surface)
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
                .accessibilityLabel("Vérification du lien en cours")
            Text("Vérification du lien...")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func invalidState(message: String) -> some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Image(systemName: "link.badge.plus")
                .font(PulpeTypography.heroIcon)
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

    private var formState: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Text("Définis ton nouveau mot de passe.")
                .font(PulpeTypography.bodyLarge)
                .multilineTextAlignment(.center)

            newPasswordField
            confirmPasswordField

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.errorPrimary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }

            Spacer()

            Button {
                Task {
                    await viewModel.submit()
                    if viewModel.isCompleted {
                        await finishFlow()
                    }
                }
            } label: {
                if viewModel.isSubmitting {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Réinitialisation en cours")
                } else {
                    Text("Valider")
                }
            }
            .primaryButtonStyle(isEnabled: viewModel.canSubmit)
            .disabled(!viewModel.canSubmit)
        }
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthSecureField(
                prompt: "8 caractères minimum",
                text: $viewModel.newPassword,
                isVisible: $showNewPassword,
                systemImage: "lock",
                isFocused: focusedField == .newPassword,
                isFilled: viewModel.isNewPasswordValid
            )
            .textContentType(.newPassword)
            .focused($focusedField, equals: .newPassword)
            .accessibilityIdentifier("resetNewPassword")
            .accessibilityLabel("Nouveau mot de passe")
            .accessibilityHint("Saisis ton nouveau mot de passe")

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                PasswordCriteriaRow(met: viewModel.hasMinLength, text: "8 caractères minimum")
                PasswordCriteriaRow(met: viewModel.hasNumber, text: "Au moins un chiffre")
                PasswordCriteriaRow(met: viewModel.hasLetter, text: "Au moins une lettre")
            }
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le nouveau mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthSecureField(
                prompt: "Confirme ton nouveau mot de passe",
                text: $viewModel.confirmPassword,
                isVisible: $showConfirmPassword,
                systemImage: "lock",
                isFocused: focusedField == .confirmPassword,
                hasError: !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed,
                isFilled: viewModel.isPasswordConfirmed
            )
            .textContentType(.newPassword)
            .focused($focusedField, equals: .confirmPassword)
            .accessibilityIdentifier("resetConfirmPassword")
            .accessibilityLabel("Confirmation du mot de passe")
            .accessibilityHint("Confirme ton nouveau mot de passe")

            if !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed {
                PasswordMatchRow(
                    icon: "xmark.circle.fill",
                    text: "Les mots de passe ne correspondent pas",
                    color: Color.errorPrimary
                )
            } else if viewModel.isPasswordConfirmed {
                PasswordMatchRow(
                    icon: "checkmark.circle.fill",
                    text: "Les mots de passe correspondent",
                    color: Color.financialSavings
                )
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

@Observable @MainActor
final class ResetPasswordFlowViewModel {
    var isPreparing = true
    var isSubmitting = false
    var invalidLinkMessage: String?
    var errorMessage: String?
    var newPassword = ""
    var confirmPassword = ""
    var shouldCleanupOnDismiss = false
    var isCompleted = false

    private let dependencies: ResetPasswordDependencies

    init(dependencies: ResetPasswordDependencies? = nil) {
        self.dependencies = dependencies ?? .live
    }

    var hasMinLength: Bool { newPassword.count >= 8 }
    var hasNumber: Bool { newPassword.contains(where: { $0.isNumber }) }
    var hasLetter: Bool { newPassword.contains(where: { $0.isLetter }) }

    var isNewPasswordValid: Bool { hasMinLength && hasNumber && hasLetter }

    var isPasswordConfirmed: Bool {
        !confirmPassword.isEmpty && newPassword == confirmPassword
    }

    var canSubmit: Bool {
        !isPreparing && !isSubmitting && isNewPasswordValid && isPasswordConfirmed
    }

    func prepare(with callbackURL: URL) async {
        isPreparing = true
        invalidLinkMessage = nil
        defer { isPreparing = false }

        do {
            _ = try await dependencies.beginPasswordRecovery(callbackURL)
            shouldCleanupOnDismiss = true
        } catch {
            invalidLinkMessage = "Ce lien n'est plus valide. Demande un nouveau lien depuis l'écran de connexion."
        }
    }

    func submit() async {
        guard canSubmit else {
            if !isNewPasswordValid {
                errorMessage = "8 caractères minimum avec au moins un chiffre"
            } else if !isPasswordConfirmed {
                errorMessage = "Les mots de passe ne correspondent pas"
            }
            return
        }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            try await dependencies.updatePassword(newPassword)
            markCompleted()
        } catch let apiError as APIError {
            handleAPIError(apiError)
        } catch {
            errorMessage = "Quelque chose n'a pas fonctionné — réessaie"
        }
    }

    private func handleAPIError(_ error: APIError) {
        switch error {
        case .rateLimited:
            errorMessage = "Trop de tentatives — patiente un moment"
        case .networkError:
            errorMessage = "Connexion impossible — vérifie ta connexion internet"
        default:
            errorMessage = error.localizedDescription
        }
    }

    private func markCompleted() {
        isCompleted = true
        shouldCleanupOnDismiss = false
    }
}

struct ResetPasswordDependencies: Sendable {
    var beginPasswordRecovery: @Sendable (URL) async throws -> PasswordRecoveryContext
    var updatePassword: @Sendable (String) async throws -> Void

    static var live: ResetPasswordDependencies {
        ResetPasswordDependencies(
            beginPasswordRecovery: { callbackURL in
                try await AuthService.shared.beginPasswordRecovery(from: callbackURL)
            },
            updatePassword: { password in
                try await AuthService.shared.updatePassword(password)
            }
        )
    }
}

#Preview {
    let previewURL = URL(string: "pulpe://reset-password#access_token=token&refresh_token=refresh&type=recovery")
    guard let callbackURL = previewURL else {
        fatalError("Preview URL is invalid")
    }
    return ResetPasswordFlowView(
        callbackURL: callbackURL,
        onComplete: {},
        onCancel: {}
    )
}
