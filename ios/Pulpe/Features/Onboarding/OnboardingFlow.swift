import SwiftUI
import VariableBlur

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: OnboardingState
    @State private var showExitConfirmation = false

    private let hasPendingSocialUser: Bool

    init(pendingSocialUser: UserInfo? = nil) {
        let initial = OnboardingState()
        if let user = pendingSocialUser {
            initial.configureSocialUser(user)
            // Skip welcome and any steps the social user doesn't need (firstName if pre-filled).
            initial.startAfterWelcome()
        }
        _state = State(initialValue: initial)
        hasPendingSocialUser = pendingSocialUser != nil
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
            .alert("Quitter l'inscription ?", isPresented: $showExitConfirmation) {
                Button("Continuer", role: .cancel) { }
                Button("Quitter", role: .destructive) { state.previousStep() }
            } message: {
                Text("Tu pourras reprendre plus tard.")
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .background,
                   state.currentStep != .welcome,
                   !state.hasCompleted,
                   !state.isSubmitting,
                   !state.hasAbandoned {
                    state.hasAbandoned = true
                    AnalyticsService.shared.capture(
                        .onboardingAbandoned,
                        properties: ["last_step": state.currentStep.analyticsName]
                    )
                }
            }
            .onChange(of: state.readyToComplete) { _, ready in
                guard ready, let user = state.authenticatedUser else { return }
                Task { await finishOnboarding(user: user) }
            }
            .task {
                // Clear consumed pendingSocialUser from AppState
                if hasPendingSocialUser {
                    appState.pendingSocialUser = nil
                }
                // Cold-start recovery: if user registered via email but app was killed,
                // recover user from Supabase session
                if state.wasEmailRegistered && !state.isAuthenticated {
                    if let user = try? await AuthService.shared.validateSession() {
                        state.configureEmailUser(user)
                    } else {
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
                    if state.editReturnStep != nil {
                        state.previousStep()
                    } else if state.wouldExitOnBack {
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

    // MARK: - Completion

    private func finishOnboarding(user: UserInfo) async {
        state.readyToComplete = false
        state.isSubmitting = true
        defer { state.isSubmitting = false }
        await appState.completeOnboarding(
            user: user,
            onboardingData: state.createTemplateData()
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

// MARK: - Base Step View

struct OnboardingStepView<Content: View>: View {
    let step: OnboardingStep
    let state: OnboardingState
    let canProceed: Bool
    let onNext: () -> Void
    var titleOverride: String?
    var subtitleOverride: String?
    @ViewBuilder let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var bottomAnchor
    @State private var showContent = false
    @State private var isAtBottom = false
    @State private var contentOverflows = false
    @State private var keyboardHeight: CGFloat = 0
    /// Dedicated trigger for the CTA "unlocked" haptic — fires only on false→true flip.
    @State private var canProceedTrigger = false

    private var isKeyboardVisible: Bool { keyboardHeight > 0 }

    private var isEnabled: Bool {
        canProceed && !state.isLoading
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    OnboardingStepHeader(
                        step: step,
                        onSkip: step.isOptional ? onNext : nil
                    )

                    content()
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .blurSlide(showContent)

                    // Error banner
                    if let error = state.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            state.error = nil
                        }
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    }

                    // Full-width CTA at bottom of scroll content
                    fullWidthCTA
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .id(bottomAnchor)
                }
                .padding(.top, DesignTokens.Spacing.stepHeaderTop)
                .padding(.bottom, DesignTokens.Spacing.xxxl
                    + (isKeyboardVisible ? 80 + DesignTokens.FrameHeight.button + DesignTokens.Spacing.lg : 0)
                )
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .onScrollGeometryChange(for: ScrollMetrics.self) { geometry in
                ScrollMetrics(
                    remaining: geometry.contentSize.height
                        - geometry.contentOffset.y - geometry.containerSize.height,
                    overflows: geometry.contentSize.height > geometry.containerSize.height + 40
                )
            } action: { _, metrics in
                let newAtBottom = metrics.remaining < 80
                let newOverflows = metrics.overflows
                guard newAtBottom != isAtBottom || newOverflows != contentOverflows else { return }
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    isAtBottom = newAtBottom
                    contentOverflows = newOverflows
                }
            }
            // Bottom blur — ignoresSafeArea BEFORE frame so it extends past home indicator
            .overlay(alignment: .bottom) {
                if (contentOverflows && !isAtBottom) || isKeyboardVisible {
                    VariableBlurView(
                        maxBlurRadius: 8,
                        direction: .blurredBottomClearTop
                    )
                    .allowsHitTesting(false)
                    .ignoresSafeArea(edges: .bottom)
                    .frame(height: DesignTokens.Blur.bottomFadeHeight)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            // Floating ↓ button — stays within safe area
            .overlay(alignment: .bottomTrailing) {
                if (contentOverflows && !isAtBottom) || isKeyboardVisible {
                    floatingButton(proxy: proxy)
                        .padding(.trailing, DesignTokens.Spacing.xxl)
                        .padding(.bottom, DesignTokens.Spacing.lg)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
        }
        .background(Color.clear)
        .dismissKeyboardOnTap()
        .onChange(of: canProceed) { oldValue, newValue in
            // Celebration haptic only on the false→true flip (CTA just unlocked)
            if !oldValue && newValue { canProceedTrigger.toggle() }
        }
        .onReceive(
            NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
        ) { notification in
            let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
            let height = frame?.height ?? 0
            withAnimation(DesignTokens.Animation.defaultSpring) {
                keyboardHeight = height
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(DesignTokens.Animation.defaultSpring) {
                keyboardHeight = 0
            }
        }
        .task {
            guard !showContent else { return }
            if reduceMotion {
                showContent = true
            } else {
                await delayedAnimation(0.25) { showContent = true }
            }
        }
    }

    // MARK: - Floating ↓ Button (Option C behavior)

    /// Keyboard open → dismiss keyboard
    /// Keyboard closed + not at bottom → scroll to CTA
    private func floatingButton(proxy: ScrollViewProxy) -> some View {
        Button {
            if isKeyboardVisible {
                UIApplication.shared.sendAction(
                    #selector(UIResponder.resignFirstResponder),
                    to: nil, from: nil, for: nil
                )
            } else {
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    proxy.scrollTo(bottomAnchor, anchor: .bottom)
                }
            }
        } label: {
            Image(systemName: isKeyboardVisible ? "keyboard.chevron.compact.down" : "arrow.down")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textOnPrimary)
                .frame(width: DesignTokens.FrameHeight.button, height: DesignTokens.FrameHeight.button)
                .background(Color.onboardingGradient)
                .clipShape(Circle())
                .contentTransition(.symbolEffect(.replace))
        }
        .shadow(DesignTokens.Shadow.elevated)
        .contentShape(Circle())
        .accessibilityLabel(isKeyboardVisible ? "Fermer le clavier" : "Voir la suite")
    }

    // MARK: - Full-Width CTA (at bottom of scroll)

    private var fullWidthCTA: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Button(action: onNext) {
                if state.isLoading {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Chargement")
                } else {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Text(buttonTitle)
                        if step != .registration && step != .budgetPreview {
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                    }
                }
            }
            .primaryButtonStyle(isEnabled: isEnabled)
            .disabled(!isEnabled)
            .scaleEffect(canProceed ? 1 : 0.98)
            .animation(reduceMotion ? .none : DesignTokens.Animation.bouncySpring, value: canProceed)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isEnabled)
            .sensoryFeedback(.success, trigger: canProceedTrigger)
        }
    }

    private var buttonTitle: String {
        switch step {
        case .registration: "Créer mon compte"
        case .budgetPreview: "Créer mon budget"
        case .welcome: "Commencer"
        default: "Continuer"
        }
    }
}

// MARK: - Scroll Metrics

private struct ScrollMetrics: Equatable {
    let remaining: CGFloat
    let overflows: Bool
}

#Preview {
    OnboardingFlow(pendingSocialUser: nil)
        .environment(AppState())
}
