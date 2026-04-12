import SwiftUI

struct RegistrationStep: View {
    @Bindable var state: OnboardingState

    @State private var password = ""
    @State private var showPassword = false
    @State private var signupTask: Task<Void, Never>?
    @State private var hasEmittedSignupStarted = false
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
            onNext: { startSignupTask() },
            content: {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    emailSection
                    passwordSection
                    consentText
                }
            }
        )
        .trackScreen("Onboarding_Registration")
        .task {
            // Fire signup_started when the user actually reaches the registration form.
            // Idempotent across back-nav from firstName within the same view instance.
            guard !hasEmittedSignupStarted else { return }
            hasEmittedSignupStarted = true
            AnalyticsService.shared.capture(.signupStarted, properties: ["method": "email"])
        }
        .onDisappear {
            // If the user abandons mid-signup (Recommencer / back), cancel the in-flight
            // task so `submitRegistration` can clean up orphan Supabase tokens before the
            // parent view unmounts.
            signupTask?.cancel()
        }
    }

    private func startSignupTask() {
        signupTask?.cancel()
        signupTask = Task { await submitRegistration() }
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
        OnboardingConsentText(attributed: Self.consentMarkdown)
            .frame(maxWidth: .infinity, alignment: .center)
    }

    private static let consentMarkdown = AppURLs.legalDisclosure(
        prefix: "En créant ton compte, tu acceptes nos",
        connector: "notre",
        suffix: "."
    )

    private func submitRegistration() async {
        state.isLoading = true
        state.error = nil

        do {
            let authService = AuthService.shared
            let user = try await authService.signup(email: state.email, password: password)

            // Race guard: if the user tapped "Recommencer" (abandonInProgressSignup)
            // while this signup was in-flight, the task is cancelled but Supabase
            // has already created a user + persisted tokens. Clean up the orphan
            // session immediately so the next onboarding attempt starts fresh.
            if Task.isCancelled {
                try? await authService.logout()
                return
            }

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
