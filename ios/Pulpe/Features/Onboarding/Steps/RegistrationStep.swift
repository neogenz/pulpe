import SwiftUI

struct RegistrationStep: View {
    @Bindable var state: OnboardingState

    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email, password
    }

    private var passwordValidator: PasswordValidator { PasswordValidator(password: password) }

    private var canSubmit: Bool {
        state.canSubmitRegistration && passwordValidator.isValid
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
                    consentText
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

    private var consentText: some View {
        Text(Self.consentMarkdown)
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.textTertiaryOnboarding)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, alignment: .center)
            .tint(Color.pulpePrimary)
    }

    private static let consentMarkdown = AppURLs.legalDisclosure(
        prefix: "En créant ton compte, tu acceptes nos",
        connector: "notre",
        suffix: "."
    )

    private func submitRegistration() async {
        state.isLoading = true
        state.error = nil
        // Implicit consent — user has read the disclosure and tapped the submit button.
        state.acceptTerms = true

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
