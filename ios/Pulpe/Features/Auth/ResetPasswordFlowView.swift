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

    var isNewPasswordValid: Bool {
        newPassword.count >= 8
    }

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
                errorMessage = "8 caractères minimum"
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
    ResetPasswordFlowView(
        callbackURL: URL(string: "pulpe://reset-password#access_token=token&refresh_token=refresh&type=recovery")!,
        onComplete: {},
        onCancel: {}
    )
}
