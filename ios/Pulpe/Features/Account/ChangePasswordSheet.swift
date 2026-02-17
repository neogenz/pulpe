import SwiftUI

struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var viewModel = ChangePasswordViewModel()
    @FocusState private var focusedField: Field?

    let onSuccess: () -> Void

    private enum Field: Hashable {
        case currentPassword
        case newPassword
        case confirmPassword
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.xl) {
                Text("Confirme ton identité pour modifier ton accès.")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                currentPasswordField
                newPasswordField
                confirmPasswordField

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.errorPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()

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
                .font(PulpeTypography.labelLarge)

            SecureField("Mot de passe actuel", text: $viewModel.currentPassword)
                .focused($focusedField, equals: .currentPassword)
                .textContentType(.password)
                .padding()
                .background(Color.surfaceCard)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
                }
                .accessibilityIdentifier("changeCurrentPasswordInput")
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
                .accessibilityIdentifier("changeNewPasswordInput")
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le nouveau mot de passe")
                .font(PulpeTypography.labelLarge)

            SecureField("Confirme le nouveau mot de passe", text: $viewModel.confirmPassword)
                .focused($focusedField, equals: .confirmPassword)
                .textContentType(.newPassword)
                .padding()
                .background(Color.surfaceCard)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.primary.opacity(0.1), lineWidth: 1)
                }
                .accessibilityIdentifier("changeConfirmPasswordInput")
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
    var isNewPasswordValid: Bool { newPassword.count >= 8 }
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
