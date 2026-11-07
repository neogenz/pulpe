import SwiftUI

struct ResetPasswordFlowView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ResetPasswordFlowViewModel()
    @State private var hasPerformedCancelCleanup = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false
    @State private var showForgotPassword = false
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
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .background(Color.sheetBackground)
            .dismissKeyboardOnTap()
            .localizedNavigationTitle("Nouveau mot de passe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton { handleCloseAction() }
                }
            }
            .keyboardFieldNavigation(focus: $focusedField, order: [.newPassword, .confirmPassword])
        }
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordSheet(initialEmail: viewModel.recoveryEmail ?? "") { showForgotPassword = false }
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
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func invalidState(message: String) -> some View {
        StatusScreen(
            systemImage: "link",
            tone: .over,
            title: AppLocale.string("Ce lien n'est plus valable"),
            message: message,
            primary: .init(title: AppLocale.string("Demander un nouveau lien")) { showForgotPassword = true },
            secondary: .init(title: AppLocale.string("Retour à la connexion")) { handleCloseAction() }
        )
    }

    private var formState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                lead

                newPasswordField
                confirmPasswordField

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.errorPrimary)
                        .padding(.horizontal, DesignTokens.Spacing.xs)
                }
            }
            .padding(.top, DesignTokens.Spacing.md)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) {
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
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(Color.sheetBackground)
        }
    }

    /// Names the account the new password is for, and says what does not change.
    private var lead: some View {
        Group {
            if let email = viewModel.recoveryEmail {
                Text("Choisis le mot de passe de **\(email)**. Ton code PIN et tes montants ne changent pas.")
            } else {
                Text("Choisis ton nouveau mot de passe. Ton code PIN et tes montants ne changent pas.")
            }
        }
        .font(PulpeTypography.onboardingSubtitle)
        .foregroundStyle(Color.textSecondary)
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimary)

            AuthSecureField(
                prompt: AppLocale.string("8 caractères minimum"),
                text: $viewModel.newPassword,
                isVisible: $showNewPassword,
                focusBinding: $focusedField,
                focusField: .newPassword
            )
            .textContentType(.newPassword)
            .accessibilityIdentifier("resetNewPassword")
            .accessibilityLabel("Nouveau mot de passe")
            .accessibilityHint("Saisis ton nouveau mot de passe")

            PasswordCriteriaList(validator: viewModel.passwordValidator)
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirme-le")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimary)

            AuthSecureField(
                prompt: AppLocale.string("Confirme ton nouveau mot de passe"),
                text: $viewModel.confirmPassword,
                isVisible: $showConfirmPassword,
                hasError: !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed,
                focusBinding: $focusedField,
                focusField: .confirmPassword
            )
            .textContentType(.newPassword)
            .accessibilityIdentifier("resetConfirmPassword")
            .accessibilityLabel("Confirmation du mot de passe")
            .accessibilityHint("Confirme ton nouveau mot de passe")

            if !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed {
                Label("""
                    Les deux mots de passe ne correspondent pas. Retape le \
                    second.
                    """, systemImage: "exclamationmark.circle.fill")
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(Color.errorPrimary)
                    .fixedSize(horizontal: false, vertical: true)
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
    /// Account the recovery link belongs to, named in the form so the user knows whose password it is.
    var recoveryEmail: String?
    var isCompleted = false

    private let dependencies: ResetPasswordDependencies

    init(dependencies: ResetPasswordDependencies? = nil) {
        self.dependencies = dependencies ?? .live
    }

    var passwordValidator: PasswordValidator { PasswordValidator(password: newPassword) }

    var isNewPasswordValid: Bool { passwordValidator.isValid }

    var isPasswordConfirmed: Bool {
        PasswordValidator.isConfirmed(password: newPassword, confirmation: confirmPassword)
    }

    var canSubmit: Bool {
        !isPreparing && !isSubmitting && isNewPasswordValid && isPasswordConfirmed
    }

    func prepare(with callbackURL: URL) async {
        isPreparing = true
        invalidLinkMessage = nil
        defer { isPreparing = false }

        do {
            let context = try await dependencies.beginPasswordRecovery(callbackURL)
            recoveryEmail = context.email.isEmpty ? nil : context.email
            shouldCleanupOnDismiss = true
        } catch {
            invalidLinkMessage = AppLocale.string(
                """
                    Un lien ne sert qu'une fois et finit par expirer. Demande-en un \
                    nouveau, il arrive en quelques secondes.
                    """
            )
        }
    }

    func submit() async {
        guard canSubmit else {
            if !isNewPasswordValid {
                errorMessage = AppLocale.string("8 caractères minimum avec au moins un chiffre")
            } else if !isPasswordConfirmed {
                errorMessage = AppLocale.string("Les deux mots de passe ne correspondent pas. Retape le second.")
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
            errorMessage = AppLocale.string("Quelque chose n'a pas fonctionné — réessaie")
        }
    }

    private func handleAPIError(_ error: APIError) {
        switch error {
        case .rateLimited:
            errorMessage = AppLocale.string("Trop de tentatives — patiente un moment")
        case .networkError:
            errorMessage = AppLocale.string("Connexion impossible — vérifie ta connexion internet")
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

    static let live = ResetPasswordDependencies(
        beginPasswordRecovery: { callbackURL in
            try await AuthService.shared.beginPasswordRecovery(from: callbackURL)
        },
        updatePassword: { password in
            try await AuthService.shared.updatePassword(password)
        }
    )
}

#Preview {
    let previewURL = URL(
        string: "https://app.pulpe.app/reset-password#access_token=token&refresh_token=refresh&type=recovery"
    )
    guard let callbackURL = previewURL else {
        fatalError("Preview URL is invalid")
    }
    return ResetPasswordFlowView(
        callbackURL: callbackURL,
        onComplete: {},
        onCancel: {}
    )
}
