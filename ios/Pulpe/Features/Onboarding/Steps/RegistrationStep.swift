import SwiftUI

struct RegistrationStep: View {
    @Bindable var state: OnboardingState

    @State private var password = ""
    @State private var passwordConfirmation = ""
    @State private var showPassword = false
    @State private var showPasswordConfirmation = false
    @State private var confirmFieldBlurred = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, password, passwordConfirmation
    }

    private var passwordValidator: PasswordValidator { PasswordValidator(password: password) }

    private var isPasswordConfirmed: Bool {
        PasswordValidator.isConfirmed(password: password, confirmation: passwordConfirmation)
    }

    /// Only show confirmation error after the user has had a fair shot:
    /// either they've left the field, or they've typed enough characters.
    private var shouldShowConfirmError: Bool {
        !passwordConfirmation.isEmpty && !isPasswordConfirmed &&
            (confirmFieldBlurred || passwordConfirmation.count >= password.count)
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
                hasError: shouldShowConfirmError
            )
            .textContentType(.newPassword)
            .focused($focusedField, equals: .passwordConfirmation)
            .accessibilityIdentifier("registrationPasswordConfirmation")
            .accessibilityLabel("Confirmation du mot de passe")
            .accessibilityHint("Confirme ton mot de passe")
            .onChange(of: focusedField) { _, newField in
                if newField != .passwordConfirmation && !passwordConfirmation.isEmpty {
                    confirmFieldBlurred = true
                }
            }

            if !passwordConfirmation.isEmpty &&
                (confirmFieldBlurred || passwordConfirmation.count >= password.count) {
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
                            lineWidth: DesignTokens.BorderWidth.thick
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

    private static let termsMarkdown = AppURLs.legalDisclosure(
        prefix: "J'accepte les",
        connector: "la"
    )

    private func submitRegistration() async {
        state.isLoading = true
        state.error = nil

        do {
            let authService = AuthService.shared
            let user = try await authService.signup(email: state.email, password: password)

            AnalyticsService.shared.capture(.signupCompleted, properties: ["method": "email"])
            state.isLoading = false
            state.configureEmailUser(user)
            state.nextStep()
        } catch let apiError as APIError {
            AnalyticsService.shared.captureAuthError(.signupFailed, error: apiError, method: "email")
            state.error = apiError
            state.isLoading = false
        } catch {
            AnalyticsService.shared.captureAuthError(.signupFailed, error: error, method: "email")
            let localizedMessage = AuthErrorLocalizer.localize(error)
            state.error = APIError.serverError(message: localizedMessage)
            state.isLoading = false
        }
    }
}

#Preview {
    RegistrationStep(state: OnboardingState())
}
