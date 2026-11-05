import SwiftUI

struct RegistrationStep: View {
    @Bindable var state: OnboardingState

    @State private var password = ""
    @State private var showPassword = false
    @State private var signupTask: Task<Void, Never>?
    /// The signup failed because the email already has an account: the banner offers the login.
    @State private var emailTaken = false
    @State private var showLogin = false
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
            subtitle: AppLocale.string("Pour retrouver ton budget sur ton téléphone et sur le web."),
            showsGenericError: !emailTaken,
            onNext: { startSignupTask() },
            zone: { lockGreeting },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    if emailTaken { emailTakenBanner }
                    emailSection
                    passwordSection
                    consentText
                }
            }
        )
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin, initialEmail: state.email)
        }
        .onChange(of: state.email) { emailTaken = false }
        .trackScreen("Onboarding_Registration")
        .task {
            // Fire signup_started when the user actually reaches the registration form.
            // Idempotent across back-nav: the guard lives on `OnboardingState` which
            // outlives step-view re-instantiation (OnboardingFlow keys each step by
            // `.id(state.currentStep)`). A `@State` guard on this struct would reset
            // every time the user taps firstName→Retour→Continuer.
            guard !state.hasEmittedSignupStarted else { return }
            state.hasEmittedSignupStarted = true
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
                .foregroundStyle(Color.textPrimary)

            AuthTextField(
                prompt: AppLocale.string("ton@email.com"),
                text: $state.email,
                hasError: emailTaken,
                isFilled: state.isEmailValid,
                focusBinding: $focusedField,
                focusField: .email
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .submitLabel(.next)
            .onSubmit { focusedField = .password }
            .accessibilityIdentifier("registrationEmail")
            .accessibilityLabel("Adresse e-mail")
            .accessibilityHint("Saisis ton adresse e-mail")
        }
    }

    private var passwordSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Mot de passe")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textPrimary)

            AuthSecureField(
                prompt: "••••••••",
                text: $password,
                isVisible: $showPassword,
                focusBinding: $focusedField,
                focusField: .password
            )
            .textContentType(.newPassword)
            .accessibilityIdentifier("registrationPassword")
            .accessibilityLabel("Mot de passe")
            .accessibilityHint("Crée ton mot de passe")

            PasswordCriteriaList(validator: passwordValidator)
        }
    }

    /// The zone answers the step: a lock and the promise that amounts are encrypted.
    private var lockGreeting: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Image(systemName: "lock.fill")
                .font(PulpeTypography.title3)
                .foregroundStyle(Color.heroInk)
                .frame(width: DesignTokens.Entry.iconDisc, height: DesignTokens.Entry.iconDisc)
                .background(Color.heroTile, in: Circle())
                .accessibilityHidden(true)
            Text(
                FirstNameResolver.normalized(state.firstName).map { AppLocale.string("Salut \($0).") }
                    ?? AppLocale.string("Salut.")
            )
                .font(PulpeTypography.sectionTitle)
                .foregroundStyle(Color.heroInk)
            Text("Tes montants seront chiffrés : personne d'autre ne les voit.")
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.heroInkSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var emailTakenBanner: some View {
        InfoBanner(style: .err, systemImage: "exclamationmark.circle") {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Cet email est déjà utilisé. Tu as peut-être déjà un compte ?")
                Button("Me connecter avec cet email") { showLogin = true }
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .frame(minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var consentText: some View {
        OnboardingConsentText(attributed: Self.consentMarkdown)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Computed, not `static let`: a stored constant would freeze the language the app
    /// happened to be in when the type was first touched.
    private static var consentMarkdown: AttributedString {
        AppURLs.legalDisclosure(for: .registration)
    }

    private func submitRegistration() async {
        // Defense-in-depth: if we're already authenticated (cold-start resume landed
        // us back on the registration step somehow), skip the signup call and just
        // advance — Supabase would reject the duplicate email and drop a confusing
        // error on a user who already has an account.
        if state.isAuthenticated {
            state.nextStep()
            return
        }

        state.isLoading = true
        state.error = nil

        do {
            let authService = AuthService.shared
            let user = try await authService.signup(
                email: state.email,
                password: password,
                firstName: state.firstName
            )

            // Race guard: if the user tapped "Recommencer" (abandonInProgressSignup)
            // while this signup was in-flight, the task is cancelled but Supabase
            // has already created a user + persisted tokens. Clean up the orphan
            // session immediately so the next onboarding attempt starts fresh.
            if Task.isCancelled {
                try? await authService.logout()
                return
            }

            AnalyticsService.shared.captureSignupCompleted(user: user, method: "email")

            var resolvedUser = user
            if FirstNameResolver.normalized(resolvedUser.firstName) == nil {
                do {
                    try await state.persistFirstName { name in
                        try await authService.updateUserFirstName(name)
                    }
                    resolvedUser = state.authenticatedUser ?? resolvedUser
                } catch {
                    // Signup already succeeded. Keep the in-memory name and
                    // advance; the banner shows on Revenus. finishOnboarding
                    // retries persist as last chance (same as social signup).
                    resolvedUser.firstName = FirstNameResolver.normalized(state.firstName)
                    state.error = APIError.serverError(
                        message: AuthErrorLocalizer.localize(error)
                    )
                }
            }

            state.isLoading = false
            state.configureEmailUser(resolvedUser)
            state.nextStep()
        } catch let apiError as APIError {
            AnalyticsService.shared.captureAuthError(.signupFailed, error: apiError, method: "email")
            emailTaken = AuthErrorLocalizer.classify(apiError) == .userAlreadyRegistered
            state.error = apiError
            state.isLoading = false
        } catch {
            AnalyticsService.shared.captureAuthError(.signupFailed, error: error, method: "email")
            let localizedMessage = AuthErrorLocalizer.localize(error)
            emailTaken = AuthErrorLocalizer.classify(error) == .userAlreadyRegistered
            state.error = APIError.serverError(message: localizedMessage)
            state.isLoading = false
        }
    }
}

#Preview {
    RegistrationStep(state: OnboardingState())
}
