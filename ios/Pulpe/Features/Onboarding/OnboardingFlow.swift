import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var state = OnboardingState()

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
                            totalSteps: OnboardingStep.allCases.count
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
                   !state.hasCompleted {
                    AnalyticsService.shared.capture(
                        .onboardingAbandoned,
                        properties: ["last_step": state.currentStep.analyticsName]
                    )
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
        case .personalInfo:
            PersonalInfoStep(state: state)
        case .expenses:
            ExpensesStep(state: state)
        case .budgetPreview:
            BudgetPreviewStep(state: state)
        case .registration:
            RegistrationStep(state: state) { user in
                Task {
                    state.hasCompleted = true
                    await appState.completeOnboarding(user: user, onboardingData: state.createTemplateData())
                    if appState.showPostAuthError {
                        state.error = APIError.serverError(message: "La création du budget a échoué. Réessaie.")
                    }
                }
            }
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
    @ViewBuilder let content: () -> Content

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showContent = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    OnboardingStepHeader(step: step)
                        .padding(.top, DesignTokens.Spacing.stepHeaderTop)

                    content()
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .blurSlide(showContent)
                }
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollBounceBehavior(.basedOnSize)

            Spacer()

            if let error = state.error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    state.error = nil
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.lg)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            OnboardingNavigationButtons(
                step: step,
                canProceed: canProceed,
                isLoading: state.isLoading,
                onNext: onNext,
                onBack: { state.previousStep() }
            )
        }
        .background(Color.clear)
        .dismissKeyboardOnTap()
        .task {
            guard !showContent else { return }
            if reduceMotion {
                showContent = true
            } else {
                await delayedAnimation(0.25) { showContent = true }
            }
        }
    }
}

#Preview {
    OnboardingFlow()
        .environment(AppState())
}
