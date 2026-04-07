import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var state: OnboardingState

    private let hasPendingSocialUser: Bool

    init(pendingSocialUser: UserInfo? = nil) {
        let initial = OnboardingState()
        if let user = pendingSocialUser {
            initial.configureSocialUser(user)
            initial.currentStep = .firstName
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
                    // Segmented progress indicator (except welcome)
                    if state.currentStep.showProgressBar {
                        OnboardingProgressIndicator(
                            currentStep: state.currentStep,
                            totalSteps: state.isSocialSignup
                                ? OnboardingStep.allCases.count - 1
                                : OnboardingStep.allCases.count
                        )
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Step content — no TabView so swipe is impossible
                    stepContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .id(state.currentStep)
                        .transition(stepTransition)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
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
            .onChange(of: state.readyForSocialCompletion) { _, ready in
                guard ready, let socialUser = state.socialUser else { return }
                Task { await finishOnboarding(user: socialUser) }
            }
            .task {
                // Clear consumed pendingSocialUser from AppState
                if hasPendingSocialUser {
                    appState.pendingSocialUser = nil
                }
            }
        }
    }

    // MARK: - Step Content

    @ViewBuilder
    private var stepContent: some View {
        switch state.currentStep {
        case .welcome:
            WelcomeStep(state: state)
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
        case .registration:
            RegistrationStep(state: state) { user in
                Task { await finishOnboarding(user: user) }
            }
        }
    }

    // MARK: - Completion

    private func finishOnboarding(user: UserInfo) async {
        state.readyForSocialCompletion = false
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
            state.readyForSocialCompletion = false
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
    @State private var showExitConfirmation = false
    @State private var isAtBottom = false
    @State private var contentOverflows = false
    @State private var isKeyboardVisible = false

    private var isEnabled: Bool {
        canProceed && !state.isLoading
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    // Back button (top-left, Revolut-style)
                    if step != .welcome {
                        backButton
                    }

                    OnboardingStepHeader(step: step)

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
                .padding(.bottom, DesignTokens.Spacing.xxxl)
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
            .overlay(alignment: .bottom) {
                // Floating gradient + ↓ button: only when content overflows AND not at bottom
                if contentOverflows && !isAtBottom {
                    VStack(spacing: 0) {
                        // Gradient fade — passes touches through to scroll
                        LinearGradient(
                            colors: [.clear, Color.onboardingFormBase],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: 80)
                        .allowsHitTesting(false)

                        // Floating ↓ button pinned bottom-right
                        HStack {
                            Spacer()
                            floatingButton(proxy: proxy)
                        }
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .padding(.bottom, DesignTokens.Spacing.lg)
                        .background(Color.onboardingFormBase)
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
        }
        .background(Color.clear)
        .dismissKeyboardOnTap()
        .alert("Quitter l'inscription ?", isPresented: $showExitConfirmation) {
            Button("Continuer", role: .cancel) { }
            Button("Quitter", role: .destructive) { state.previousStep() }
        } message: {
            Text("Ta progression ne sera pas sauvegardée.")
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            isKeyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            isKeyboardVisible = false
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
                        if step != .registration {
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                    }
                }
            }
            .primaryButtonStyle(isEnabled: isEnabled)
            .disabled(!isEnabled)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isEnabled)
        }
    }

    // MARK: - Back Button (top area)

    private var backButton: some View {
        HStack {
            Button {
                if state.wouldExitOnBack {
                    showExitConfirmation = true
                } else {
                    state.previousStep()
                }
            } label: {
                HStack(spacing: DesignTokens.Spacing.xs) {
                    Image(systemName: "chevron.left")
                        .font(PulpeTypography.labelLarge)
                    Text("Retour")
                        .font(PulpeTypography.buttonSecondary)
                }
                .foregroundStyle(Color.textSecondaryOnboarding)
            }
            .textLinkButtonStyle()
            Spacer()
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }

    private var buttonTitle: String {
        switch step {
        case .registration: "Créer mon compte"
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
