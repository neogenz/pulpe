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

    private var passwordValidator: PasswordValidator { PasswordValidator(password: password) }

    private var isPasswordConfirmed: Bool {
        PasswordValidator.isConfirmed(password: password, confirmation: passwordConfirmation)
    }

    private var canSubmit: Bool {
        state.canSubmitRegistration && passwordValidator.isValid && isPasswordConfirmed
    }

    var body: some View {
        OnboardingStepView(
            step: .registration,
            state: state,
            canProceed: canSubmit,
            onNext: { Task { await submitRegistration() } },
            content: {
                VStack(spacing: DesignTokens.Spacing.xxl) {
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
                .font(PulpeTypography.inputLabel)
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
                .font(PulpeTypography.inputLabel)
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

            PasswordCriteriaList(validator: passwordValidator)
        }
    }

    private var confirmPasswordSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Confirmer le mot de passe")
                .font(PulpeTypography.inputLabel)
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
                        .frame(width: DesignTokens.Checkbox.size, height: DesignTokens.Checkbox.size)
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
