import SwiftUI

struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var viewModel = ChangePasswordViewModel()
    @FocusState private var focusedField: Field?
    
    @State private var showCurrentPassword = false
    @State private var showNewPassword = false
    @State private var showConfirmPassword = false

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
                        HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundStyle(Color.errorPrimary)
                            Text(error)
                                .font(PulpeTypography.labelMedium)
                                .foregroundStyle(Color.errorPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(DesignTokens.Spacing.md)
                        .background(Color.errorPrimary.opacity(0.1))
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                    }

                    Spacer(minLength: DesignTokens.Spacing.xl)

                    Button {
                        Task {
                            await viewModel.submit(email: appState.currentUser?.email)
                            if viewModel.isCompleted {
                                dismiss()
                                onSuccess()
                            }
                        }
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            if viewModel.isSubmitting {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(viewModel.isSubmitting ? "Mise à jour..." : "Confirmer")
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
                    .accessibilityIdentifier("changePasswordSubmit")
                }
                .padding(DesignTokens.Spacing.xl)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Changer le mot de passe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .background(Color.surfacePrimary)
        }
    }

    private var currentPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Mot de passe actuel")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondaryOnboarding)

            passwordField(
                placeholder: "",
                text: $viewModel.currentPassword,
                isVisible: $showCurrentPassword,
                focused: .currentPassword,
                accessibilityId: "changeCurrentPasswordInput",
                contentType: .password
            )
        }
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau mot de passe")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondaryOnboarding)

            passwordField(
                placeholder: "",
                text: $viewModel.newPassword,
                isVisible: $showNewPassword,
                focused: .newPassword,
                accessibilityId: "changeNewPasswordInput",
                contentType: .newPassword
            )
            
            passwordRequirementsHint
        }
    }
    
    private var passwordRequirementsHint: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            requirementRow(
                met: viewModel.newPassword.count >= 8,
                text: "8 caractères minimum"
            )
            requirementRow(
                met: viewModel.hasLetter,
                text: "Au moins une lettre"
            )
            requirementRow(
                met: viewModel.hasNumber,
                text: "Au moins un chiffre"
            )
        }
        .padding(.top, DesignTokens.Spacing.xs)
    }
    
    private func requirementRow(met: Bool, text: String) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: met ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14))
                .foregroundStyle(met ? Color.financialSavings : Color.textTertiary)
            Text(text)
                .font(PulpeTypography.caption)
                .foregroundStyle(met ? Color.textSecondaryOnboarding : Color.textTertiary)
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le nouveau mot de passe")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondaryOnboarding)

            passwordField(
                placeholder: "",
                text: $viewModel.confirmPassword,
                isVisible: $showConfirmPassword,
                focused: .confirmPassword,
                accessibilityId: "changeConfirmPasswordInput",
                contentType: .newPassword
            )
            
            if !viewModel.confirmPassword.isEmpty && !viewModel.isPasswordConfirmed {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.errorPrimary)
                    Text("Les mots de passe ne correspondent pas")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.errorPrimary)
                }
                .padding(.top, DesignTokens.Spacing.xs)
            } else if viewModel.isPasswordConfirmed {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.financialSavings)
                    Text("Les mots de passe correspondent")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.financialSavings)
                }
                .padding(.top, DesignTokens.Spacing.xs)
            }
        }
    }
    
    private func passwordField(
        placeholder: String,
        text: Binding<String>,
        isVisible: Binding<Bool>,
        focused: Field,
        accessibilityId: String,
        contentType: UITextContentType
    ) -> some View {
        HStack(spacing: 0) {
            Group {
                if isVisible.wrappedValue {
                    TextField(placeholder, text: text)
                } else {
                    SecureField(placeholder, text: text)
                }
            }
            .focused($focusedField, equals: focused)
            .textContentType(contentType)
            
            Button {
                isVisible.wrappedValue.toggle()
            } label: {
                Image(systemName: isVisible.wrappedValue ? "eye.slash.fill" : "eye.fill")
                    .foregroundStyle(Color.textTertiary)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
        }
        .padding(DesignTokens.Spacing.md)
        .background(Color.surfaceCard)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
        }
        .accessibilityIdentifier(accessibilityId)
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
    
    var hasLetter: Bool {
        newPassword.contains(where: { $0.isLetter })
    }
    
    var hasNumber: Bool {
        newPassword.contains(where: { $0.isNumber })
    }
    
    var isNewPasswordValid: Bool {
        newPassword.count >= 8 && hasLetter && hasNumber
    }
    
    var isPasswordConfirmed: Bool {
        !confirmPassword.isEmpty && newPassword == confirmPassword
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

    static var live: ChangePasswordDependencies {
        ChangePasswordDependencies(
        verifyPassword: { email, password in
            try await AuthService.shared.verifyPassword(email: email, password: password)
        },
        updatePassword: { newPassword in
            try await AuthService.shared.updatePassword(newPassword)
        }
        )
    }
}

#Preview {
    ChangePasswordSheet(onSuccess: {})
        .environment(AppState())
}
