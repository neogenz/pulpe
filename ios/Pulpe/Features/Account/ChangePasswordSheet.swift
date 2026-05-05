import SwiftUI

struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var viewModel = ChangePasswordViewModel()
    @FocusState private var focusedField: Field?

    @State private var showCurrentPassword = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false
    @State private var submitSuccessTrigger = false

    let onSuccess: () -> Void

    private enum Field: Hashable {
        case currentPassword
        case newPassword
        case confirmPassword
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Text("Confirme ton identité pour modifier ton accès.")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                        .padding(.bottom, DesignTokens.Spacing.sm)

                    currentPasswordField
                    newPasswordField
                    confirmPasswordField

                    if let error = viewModel.errorMessage {
                        ErrorBanner(message: error)
                    }

                    Spacer(minLength: DesignTokens.Spacing.xl)

                    Button {
                        Task {
                            await viewModel.submit(email: appState.currentUser?.email)
                            if viewModel.isCompleted {
                                submitSuccessTrigger.toggle()
                                dismiss()
                                onSuccess()
                            }
                        }
                    } label: {
                        if viewModel.isSubmitting {
                            ProgressView()
                                .tint(.white)
                                .accessibilityLabel("Mise à jour en cours")
                        } else {
                            Text("Confirmer")
                        }
                    }
                    .primaryButtonStyle(isEnabled: viewModel.canSubmit)
                    .disabled(!viewModel.canSubmit)
                    .accessibilityIdentifier("changePasswordSubmit")
                }
                .padding(DesignTokens.Spacing.xl)
            }
            .contentMargins(.bottom, DesignTokens.Spacing.xxl, for: .scrollContent)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Changer le mot de passe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
            .background(Color.sheetBackground)
            .keyboardFieldNavigation(focus: $focusedField, order: [.currentPassword, .newPassword, .confirmPassword])
            .dismissKeyboardOnTap()
        }
        .standardSheetPresentation()
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    private var currentPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Mot de passe actuel")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            AuthSecureField(
                prompt: "Ton mot de passe actuel",
                text: $viewModel.currentPassword,
                isVisible: $showCurrentPassword,
                systemImage: "lock",
                focusBinding: $focusedField,
                focusField: .currentPassword
            )
            .textContentType(.password)
            .accessibilityIdentifier("changeCurrentPasswordInput")
        }
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau mot de passe")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            AuthSecureField(
                prompt: "Ton nouveau mot de passe",
                text: $viewModel.newPassword,
                isVisible: $showNewPassword,
                systemImage: "lock",
                focusBinding: $focusedField,
                focusField: .newPassword
            )
            .textContentType(.newPassword)
            .accessibilityIdentifier("changeNewPasswordInput")

            passwordRequirementsHint
        }
    }

    private var passwordRequirementsHint: some View {
        PasswordCriteriaList(validator: viewModel.passwordValidator)
            .padding(.top, DesignTokens.Spacing.xs)
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le nouveau mot de passe")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            AuthSecureField(
                prompt: "Confirme ton nouveau mot de passe",
                text: $viewModel.confirmPassword,
                isVisible: $showConfirmPassword,
                systemImage: "lock",
                hasError: !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed,
                focusBinding: $focusedField,
                focusField: .confirmPassword
            )
            .textContentType(.newPassword)
            .accessibilityIdentifier("changeConfirmPasswordInput")

            if !viewModel.confirmPassword.isEmpty {
                PasswordMatchRow(matches: viewModel.isPasswordConfirmed)
            }
        }
    }
}

@Observable @MainActor
final class ChangePasswordViewModel {
    var currentPassword = ""
    var newPassword = ""
    var confirmPassword = ""
    var isSubmitting = false
    var errorMessage: String?
    var isCompleted = false

    private let dependencies: ChangePasswordDependencies

    init(dependencies: ChangePasswordDependencies? = nil) {
        self.dependencies = dependencies ?? .live
    }

    var isCurrentPasswordValid: Bool { !currentPassword.isEmpty }

    var passwordValidator: PasswordValidator { PasswordValidator(password: newPassword) }

    var isNewPasswordValid: Bool { passwordValidator.isValid }

    var isPasswordConfirmed: Bool {
        PasswordValidator.isConfirmed(password: newPassword, confirmation: confirmPassword)
    }

    var canSubmit: Bool {
        isCurrentPasswordValid && isNewPasswordValid && isPasswordConfirmed && !isSubmitting
    }

    func submit(email: String?) async {
        guard canSubmit else {
            if !isCurrentPasswordValid {
                errorMessage = "Le mot de passe actuel est requis"
            } else if !isNewPasswordValid {
                errorMessage = "8 caractères minimum"
            } else if !isPasswordConfirmed {
                errorMessage = "Les mots de passe ne correspondent pas"
            }
            return
        }

        guard let email, !email.isEmpty else {
            errorMessage = "Utilisateur non connecté"
            return
        }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            try await dependencies.verifyPassword(email, currentPassword)
            try await dependencies.updatePassword(newPassword)
            isCompleted = true
        } catch {
            if AuthErrorLocalizer.isInvalidCredentials(error) {
                errorMessage = "Mot de passe actuel incorrect"
            } else {
                errorMessage = AuthErrorLocalizer.localize(error)
            }
        }
    }
}

struct ChangePasswordDependencies: Sendable {
    var verifyPassword: @Sendable (String, String) async throws -> Void
    var updatePassword: @Sendable (String) async throws -> Void

    static let live = ChangePasswordDependencies(
        verifyPassword: { email, password in
            try await AuthService.shared.verifyPassword(email: email, password: password)
        },
        updatePassword: { newPassword in
            try await AuthService.shared.updatePassword(newPassword)
        }
    )
}

#Preview {
    ChangePasswordSheet(onSuccess: {})
        .environment(AppState())
}
