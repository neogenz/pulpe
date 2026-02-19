import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var state = OnboardingState()

    var body: some View {
        NavigationStack {
            ZStack {
                // Beautiful auth gradient background (same as welcome/login)
                Color.authGradientBackground

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
                appState.completeOnboarding(user: user, onboardingData: state.createTemplateData())
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
    @State private var contentOpacity: Double = 0
    @State private var contentOffset: CGFloat = 20

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 24) {
                    // New animated header with icon
                    OnboardingStepHeader(step: step)
                        .padding(.top, 24)

                    // Content with entrance animation
                    content()
                        .padding(.horizontal, 24)
                        .opacity(contentOpacity)
                        .offset(y: contentOffset)
                }
            }
            .scrollBounceBehavior(.basedOnSize)

            Spacer()

            // Error display
            if let error = state.error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    state.error = nil
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            // New gradient navigation buttons
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
        .onAppear {
            if reduceMotion {
                contentOpacity = 1
                contentOffset = 0
            } else {
                withAnimation(.easeOut(duration: 0.4).delay(0.2)) {
                    contentOpacity = 1
                    contentOffset = 0
                }
            }
        }
    }
}

#Preview {
    OnboardingFlow()
        .environment(AppState())
}
