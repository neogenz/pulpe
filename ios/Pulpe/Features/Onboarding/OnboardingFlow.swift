import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: OnboardingState
    @State private var showExitConfirmation = false
    @State private var hasEmittedResumed = false
    @State private var hasEmittedStarted = false

    private let pendingUser: PendingOnboardingUser?

    init(pendingUser: PendingOnboardingUser? = nil) {
        let initial = OnboardingState()
        switch pendingUser {
        case .social(let user):
            initial.configureSocialUser(user)
            // Skip welcome and any steps the social user doesn't need (firstName if pre-filled).
            initial.startAfterWelcome()
        case .email(let user):
            // Email recovery: persisted OnboardingState was already loaded by `init()`.
            // DO NOT call startAfterWelcome — currentStep from UserDefaults is what we want.
            initial.configureEmailUser(user)
            // If the app died between Supabase signup success and the nextStep() that
            // advances past `.registration`, the persisted step is stuck on registration
            // and tapping "Créer mon compte" would re-signup the same email. Skip past it.
            initial.resumeEmailUserAfterRegistration()
        case .none:
            break
        }
        _state = State(initialValue: initial)
        self.pendingUser = pendingUser
    }

    var body: some View {
        NavigationStack {
            ZStack {
                // Subtle branded gradient for onboarding form steps
                Color.loginGradientBackground

                VStack(spacing: 0) {
                    // Sticky navigation header (progress + back)
                    if state.currentStep.showProgressBar {
                        stickyHeader
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Step content — no TabView so swipe is impossible
                    stepContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .id(state.currentStep)
                        .transition(stepTransition)
                        .sensoryFeedback(.impact(weight: .light), trigger: state.currentStep)
                        .overlay(alignment: .top) {
                            if state.currentStep.showProgressBar {
                                LinearGradient(
                                    colors: [.onboardingFormBase, .onboardingFormBase.opacity(0)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                                .frame(height: DesignTokens.Blur.topFadeHeight)
                                .allowsHitTesting(false)
                            }
                        }
                }
                .background {
                    Color.onboardingFormBase
                        .ignoresSafeArea()
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .alert(
                state.isAuthenticated ? "Recommencer l'inscription ?" : "Quitter l'inscription ?",
                isPresented: $showExitConfirmation
            ) {
                Button("Rester", role: .cancel) { }
                if state.isAuthenticated {
                    Button("Recommencer", role: .destructive) {
                        captureAbandoned(exitMethod: .restartButton)
                        Task { await appState.abandonInProgressSignup() }
                    }
                } else {
                    Button("Quitter", role: .destructive) {
                        captureAbandoned(exitMethod: .quitButton)
                        state.previousStep()
                    }
                }
            } message: {
                Text(
                    state.isAuthenticated
                        ? "Ton compte en cours sera déconnecté. Tu pourras en recréer un nouveau."
                        : "Tu pourras reprendre plus tard."
                )
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .background,
                   state.currentStep != .welcome,
                   !state.hasCompleted,
                   !state.isSubmitting,
                   !state.hasAbandoned {
                    captureAbandoned(exitMethod: .background)
                }
            }
            .onChange(of: state.readyToComplete) { _, ready in
                guard ready, let user = state.authenticatedUser else { return }
                Task { await finishOnboarding(user: user) }
            }
            .onChange(of: state.currentStep) { oldStep, newStep in
                // Fresh email path: user just tapped the welcome CTA and advanced
                // to firstName. Social and email-recovery paths are handled in `.task`
                // where the pending user is consumed.
                guard pendingUser == nil, oldStep == .welcome, newStep != .welcome else {
                    return
                }
                emitStartedIfNeeded()
            }
            .task {
                // Consume the pending user from AppState. Social users are entering
                // the flow for the first time post-OAuth → `onboarding_started`.
                // Email pending users are cold-starting a signup in progress →
                // `onboarding_resumed`. Idempotent via `hasEmittedStarted` /
                // `hasEmittedResumed` — `.task` can re-fire on view re-entry.
                if let pendingUser {
                    appState.pendingOnboardingUser = nil
                    switch pendingUser {
                    case .social:
                        emitStartedIfNeeded()
                    case .email:
                        emitResumedIfNeeded(method: pendingUser.resumeMethod, source: .pendingUser)
                    }
                }
                // Legacy fallback for sessions without provider metadata — will retire
                // once all pre-provider-routing sessions expire.
                if state.wasEmailRegistered && !state.isAuthenticated {
                    if let user = try? await AuthService.shared.validateSession() {
                        state.configureEmailUser(user)
                        emitResumedIfNeeded(method: .email, source: .sessionFallback)
                    } else {
                        // Session expired or unrecoverable — purge the persisted draft so the next
                        // `OnboardingState.init()` doesn't ping-pong back to the mid-flow step via
                        // `loadFromStorage()`. Without this we get an infinite welcome → mid-step loop.
                        state.clearStorage()
                        state.wasEmailRegistered = false
                        state.currentStep = .welcome
                    }
                }
            }
        }
    }

    // MARK: - Sticky Header

    private var stickyHeader: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            OnboardingProgressIndicator(
                currentStep: state.currentStep,
                progressSteps: state.progressBarSteps
            )

            HStack {
                Button {
                    if state.wouldExitOnBack && state.editReturnStep == nil {
                        showExitConfirmation = true
                    } else {
                        state.previousStep()
                    }
                } label: {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Image(systemName: "chevron.left")
                            .font(PulpeTypography.labelLarge)
                        Text(state.editReturnStep != nil ? "Retour au résumé" : "Retour")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .foregroundStyle(Color.textSecondaryOnboarding)
                }
                .textLinkButtonStyle()
                Spacer()
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
        }
    }

    // MARK: - Step Content

    @ViewBuilder
    private var stepContent: some View {
        switch state.currentStep {
        case .welcome:
            WelcomeStep(state: state)
        case .registration:
            RegistrationStep(state: state)
        case .firstName:
            FirstNameStep(state: state)
        case .income:
            IncomeStep(state: state)
        case .charges:
            ChargesStep(state: state)
        case .savings:
            SavingsStep(state: state)
        case .budgetPreview:
            BudgetPreviewStep(state: state)
        }
    }

    // MARK: - Analytics

    /// Typed exit trigger for `onboarding_abandoned` events.
    private enum ExitMethod: String {
        case background
        case quitButton = "quit_button"
        case restartButton = "restart_button"
    }

    /// Typed `onboarding_resumed` source for disambiguating the recovery path.
    private enum ResumeSource: String {
        case pendingUser = "pending_user"
        case sessionFallback = "session_fallback"
    }

    /// Fire `onboarding_abandoned`. Idempotent via `state.hasAbandoned`.
    private func captureAbandoned(exitMethod: ExitMethod) {
        guard !state.hasAbandoned else { return }
        state.hasAbandoned = true
        AnalyticsService.shared.capture(
            .onboardingAbandoned,
            properties: [
                "last_step": state.currentStep.analyticsName,
                "exit_method": exitMethod.rawValue,
                "was_authenticated": state.isAuthenticated,
                "auth_method": state.authMethodProperty
            ]
        )
    }

    /// Fire `onboarding_started` once per session when the user enters the
    /// multi-step flow for the first time (email welcome→next, or fresh social
    /// OAuth). `@State` idempotency survives view re-evaluations but resets on
    /// re-instantiation via `.id(appState.onboardingSessionID)` after abandon.
    private func emitStartedIfNeeded() {
        guard !hasEmittedStarted else { return }
        hasEmittedStarted = true
        AnalyticsService.shared.capture(
            .onboardingStarted,
            properties: [
                "method": state.authMethodProperty
            ]
        )
    }

    /// Fire `onboarding_resumed` for a user who re-enters the flow mid-way.
    /// Idempotent via `hasEmittedResumed` — `.task` can fire multiple times if
    /// the view leaves and re-enters the hierarchy.
    private func emitResumedIfNeeded(
        method: PendingOnboardingUser.ResumeMethod,
        source: ResumeSource
    ) {
        guard !hasEmittedResumed else { return }
        hasEmittedResumed = true
        AnalyticsService.shared.capture(
            .onboardingResumed,
            properties: [
                "method": method.rawValue,
                "source": source.rawValue,
                "resumed_at_step": state.currentStep.analyticsName
            ]
        )
    }

    // MARK: - Completion

    private func finishOnboarding(user: UserInfo) async {
        state.readyToComplete = false
        state.isSubmitting = true
        defer { state.isSubmitting = false }

        // The onboarding template schema doesn't carry currency, so persist the user's
        // pick to user_settings before bootstrap so all subsequent amounts use it.
        if state.currency != userSettingsStore.currency {
            await userSettingsStore.updateCurrency(state.currency)
        }

        await appState.completeOnboarding(
            user: user,
            onboardingData: state.createTemplateData(),
            signupMethod: state.authMethodProperty
        )
        if appState.showPostAuthError {
            // Capture error locally and clear global flag
            // to avoid dual error surfaces (global alert + local banner).
            appState.showPostAuthError = false
            state.error = APIError.serverError(
                message: "La création du budget a échoué. Réessaie."
            )
            state.readyToComplete = false
        } else {
            state.hasCompleted = true
        }
    }

    /// Slide from trailing when advancing, from leading when going back
    private var stepTransition: AnyTransition {
        if reduceMotion {
            return .opacity
        }
        return .asymmetric(
            insertion: .move(edge: state.isMovingForward ? .trailing : .leading),
            removal: .move(edge: state.isMovingForward ? .leading : .trailing)
        )
    }
}

#Preview {
    OnboardingFlow()
        .environment(AppState())
        .environment(UserSettingsStore())
}
