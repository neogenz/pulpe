import SwiftUI

struct ForgotPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ForgotPasswordViewModel()
    @FocusState private var isEmailFocused: Bool

    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isSuccess {
                    successState
                } else {
                    formState
                }
            }
            .padding(DesignTokens.Spacing.xl)
            .background(Color.surface)
            .navigationTitle("Mot de passe oublié")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") {
                        dismiss()
                        onClose()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.surface)
        .task { isEmailFocused = true }
        .accessibilityIdentifier("forgotPasswordPage")
    }

    private var formState: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Text("Entre ton email pour recevoir un lien de réinitialisation.")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
                .padding(.top, DesignTokens.Spacing.md)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Adresse e-mail")
                    .font(PulpeTypography.buttonSecondary)
                    .foregroundStyle(Color.textPrimaryOnboarding)

                AuthTextField(
                    prompt: "ton@email.com",
                    text: $viewModel.email,
                    systemImage: "envelope",
                    isFocused: isEmailFocused,
                    hasError: viewModel.errorMessage != nil,
                    isFilled: viewModel.isEmailValid
                )
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($isEmailFocused)
                .accessibilityIdentifier("forgotPasswordEmail")

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.errorPrimary)
                        .padding(.leading, DesignTokens.Spacing.xs)
                }
            }

            Button {
                Task { await viewModel.submit() }
            } label: {
                if viewModel.isSubmitting {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Envoi en cours")
                } else {
                    Text("Envoyer le lien")
                }
            }
            .primaryButtonStyle(isEnabled: viewModel.canSubmit)
            .disabled(!viewModel.canSubmit)
            .accessibilityIdentifier("forgotPasswordSubmit")
        }
    }

    private var successState: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Image(systemName: "envelope.badge")
                .font(PulpeTypography.heroIcon)
                .foregroundStyle(Color.pulpePrimary)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Email envoyé")
                    .font(PulpeTypography.onboardingTitle)
                Text("Si un compte existe avec cette adresse, tu recevras un email avec un lien de réinitialisation.")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
                Text("Pense à vérifier tes spams si tu ne le vois pas.")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
            }

            Button("Retour à la connexion") {
                dismiss()
                onClose()
            }
            .primaryButtonStyle()
        }
        .accessibilityIdentifier("forgotPasswordSuccess")
    }
}

@Observable @MainActor
final class ForgotPasswordViewModel {
    var email = ""
    var isSubmitting = false
    var isSuccess = false
    var errorMessage: String?

    private let dependencies: ForgotPasswordDependencies

    init(dependencies: ForgotPasswordDependencies = .live) {
        self.dependencies = dependencies
    }

    var isEmailValid: Bool {
        let pattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil
    }

    var canSubmit: Bool {
        isEmailValid && !isSubmitting
    }

    func submit() async {
        guard isEmailValid else {
            errorMessage = "Cette adresse email ne semble pas valide"
            return
        }

        isSubmitting = true
        errorMessage = nil

        defer { isSubmitting = false }

        do {
            try await dependencies.requestPasswordReset(email)
            isSuccess = true
        } catch {
            errorMessage = AuthErrorLocalizer.localize(error)
        }
    }
}

struct ForgotPasswordDependencies: Sendable {
    var requestPasswordReset: @Sendable (String) async throws -> Void

    static let live = ForgotPasswordDependencies(
        requestPasswordReset: { email in
            try await AuthService.shared.requestPasswordReset(email: email)
        }
    )
}

#Preview {
    ForgotPasswordSheet(onClose: {})
}
