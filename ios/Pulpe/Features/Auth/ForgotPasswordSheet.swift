import SwiftUI

struct ForgotPasswordSheet: View {
    private enum FormField: Hashable {
        case email
    }

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = ForgotPasswordViewModel()
    @FocusState private var focusedField: FormField?

    /// Email already typed on the login, so the user does not retype it.
    var initialEmail = ""
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
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.sheetBackground)
            .dismissKeyboardOnTap()
            .localizedNavigationTitle("Mot de passe oublié")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton {
                        dismiss()
                        onClose()
                    }
                }
            }
            .keyboardFieldNavigation(focus: $focusedField, order: [.email])
        }
        .standardSheetPresentation(detents: [.medium, .large])
        .task {
            if viewModel.email.isEmpty { viewModel.email = initialEmail }
            focusedField = .email
        }
        .accessibilityIdentifier("forgotPasswordPage")
    }

    private var formState: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Entre ton e-mail. Je t'envoie un lien pour choisir un nouveau mot de passe.")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Adresse e-mail")
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(Color.textPrimary)

                AuthTextField(
                    prompt: AppLocale.string("ton@email.com"),
                    text: $viewModel.email,
                    hasError: viewModel.errorMessage != nil,
                    isFilled: viewModel.isEmailValid,
                    focusBinding: $focusedField,
                    focusField: .email
                )
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("forgotPasswordEmail")
                .accessibilityLabel("Adresse e-mail")
                .accessibilityHint("Saisis ton adresse e-mail")

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.errorPrimary)
                        .padding(.leading, DesignTokens.Spacing.xs)
                }
            }

            Text("Ton code PIN et tes montants ne changent pas.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)

            Spacer(minLength: DesignTokens.Spacing.none)

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
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
    }

    private var successState: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "envelope")
                .font(PulpeTypography.title2)
                .foregroundStyle(Color.accentInk)
                .frame(width: DesignTokens.Control.statusDisc, height: DesignTokens.Control.statusDisc)
                .background(Color.accentWash, in: Circle())
                .accessibilityHidden(true)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("E-mail envoyé")
                    .font(PulpeTypography.statusTitle)
                Text("""
                    Si un compte existe avec **\(viewModel.email)**, tu vas recevoir un \
                    lien pour choisir un nouveau mot de passe.
                    """)
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
                Text("Rien reçu ? Regarde dans tes spams.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
            .multilineTextAlignment(.center)

            Spacer(minLength: DesignTokens.Spacing.none)

            Button("Retour à la connexion") {
                dismiss()
                onClose()
            }
            .secondaryButtonStyle()
            .padding(.bottom, DesignTokens.Spacing.lg)
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
        email.isValidEmail
    }

    var canSubmit: Bool {
        isEmailValid && !isSubmitting
    }

    func submit() async {
        guard isEmailValid else {
            errorMessage = AppLocale.string("Cette adresse email ne semble pas valide")
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
