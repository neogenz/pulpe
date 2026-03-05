import SwiftUI

struct RegistrationStep: View {
    @Bindable var state: OnboardingState
    let onComplete: (UserInfo) -> Void

    @State private var password = ""
    @State private var passwordConfirmation = ""
    @State private var showPassword = false
    @State private var showPasswordConfirmation = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, password, passwordConfirmation
    }

    private var hasMinLength: Bool { password.count >= 8 }
    private var hasNumber: Bool { password.contains(where: { $0.isNumber }) }
    private var hasLetter: Bool { password.contains(where: { $0.isLetter }) }
    private var isPasswordValid: Bool { hasMinLength && hasNumber && hasLetter }

    private var isPasswordConfirmed: Bool {
        !passwordConfirmation.isEmpty && password == passwordConfirmation
    }

    private var canSubmit: Bool {
        state.canSubmitRegistration && isPasswordValid && isPasswordConfirmed
    }

    var body: some View {
        OnboardingStepView(
            step: .registration,
            state: state,
            canProceed: canSubmit,
            onNext: { Task { await submitRegistration() } },
            content: {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    Text("Crée ton compte pour sauvegarder ton budget")
                        .font(PulpeTypography.body.weight(.medium))
                        .foregroundStyle(Color.textPrimaryOnboarding)
                        .multilineTextAlignment(.center)
                        .padding(.bottom, DesignTokens.Spacing.sm)

                    emailSection
                    passwordSection
                    confirmPasswordSection
                    termsCheckbox
                }
            }
        )
        .trackScreen("Onboarding_Registration")
    }
}

// MARK: - Sections

extension RegistrationStep {
    private var emailSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Email")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthTextField(
                prompt: "ton@email.com",
                text: $state.email,
                systemImage: "envelope",
                isFocused: focusedField == .email,
                isFilled: state.isEmailValid
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("registrationEmail")
            .accessibilityLabel("Adresse e-mail")
            .accessibilityHint("Saisis ton adresse e-mail")
            .focused($focusedField, equals: .email)
        }
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthSecureField(
                prompt: "••••••••",
                text: $password,
                isVisible: $showPassword,
                systemImage: "lock",
                isFocused: focusedField == .password
            )
            .textContentType(.newPassword)
            .focused($focusedField, equals: .password)
            .accessibilityIdentifier("registrationPassword")
            .accessibilityLabel("Mot de passe")
            .accessibilityHint("Crée ton mot de passe")

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                PasswordCriteriaRow(met: hasMinLength, text: "8 caractères minimum")
                PasswordCriteriaRow(met: hasNumber, text: "Au moins un chiffre")
                PasswordCriteriaRow(met: hasLetter, text: "Au moins une lettre")
            }
        }
    }

    private var confirmPasswordSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le mot de passe")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.textPrimaryOnboarding)

            AuthSecureField(
                prompt: "••••••••",
                text: $passwordConfirmation,
                isVisible: $showPasswordConfirmation,
                systemImage: "lock",
                isFocused: focusedField == .passwordConfirmation,
                hasError: !passwordConfirmation.isEmpty && !isPasswordConfirmed
            )
            .textContentType(.newPassword)
            .focused($focusedField, equals: .passwordConfirmation)
            .accessibilityIdentifier("registrationPasswordConfirmation")
            .accessibilityLabel("Confirmation du mot de passe")
            .accessibilityHint("Confirme ton mot de passe")

            if !passwordConfirmation.isEmpty {
                PasswordMatchRow(matches: isPasswordConfirmed)
            }
        }
    }

    private var termsCheckbox: some View {
        Button {
            state.acceptTerms.toggle()
        } label: {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                ZStack {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm, style: .continuous)
                        .strokeBorder(
                            state.acceptTerms ? Color.pulpePrimary :
                                Color.textPrimaryOnboarding.opacity(0.4),
                            lineWidth: 2
                        )
                        .frame(width: 24, height: 24)
                        .background {
                            if !state.acceptTerms {
                                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm, style: .continuous)
                                    .fill(Color.authInputBackground)
                            }
                        }

                    if state.acceptTerms {
                        Image(systemName: "checkmark")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.pulpePrimary)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: state.acceptTerms)

                Text(Self.termsMarkdown)
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private static let termsMarkdown: AttributedString = {
        let termsLink = AppURLs.terms.absoluteString
        let privacyLink = AppURLs.privacy.absoluteString
        let md = "J'accepte les [conditions d'utilisation](\(termsLink))"
            + " et la [politique de confidentialité](\(privacyLink))"
        let fallback = "J'accepte les conditions d'utilisation et la politique de confidentialité"
        return (try? AttributedString(markdown: md)) ?? AttributedString(fallback)
    }()

    private func submitRegistration() async {
        state.isLoading = true
        state.error = nil

        do {
            let authService = AuthService.shared
            let user = try await authService.signup(email: state.email, password: password)

            AnalyticsService.shared.capture(.signupCompleted, properties: ["method": "email"])
            state.isLoading = false
            onComplete(user)
        } catch let apiError as APIError {
            state.error = apiError
            state.isLoading = false
        } catch {
            let localizedMessage = AuthErrorLocalizer.localize(error)
            state.error = APIError.serverError(message: localizedMessage)
            state.isLoading = false
        }
    }
}

#Preview {
    RegistrationStep(state: OnboardingState()) { user in
        print("Completed with user: \(user)")
    }
}
