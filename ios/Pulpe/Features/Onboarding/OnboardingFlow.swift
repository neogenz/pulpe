import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @State private var state = OnboardingState()

    var body: some View {
        NavigationStack {
            ZStack {
                // Enhanced background
                Color.onboardingBackground
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // New segmented progress indicator (except welcome)
                    if state.currentStep.showProgressBar {
                        OnboardingProgressIndicator(
                            currentStep: state.currentStep,
                            totalSteps: OnboardingStep.allCases.count
                        )
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Step content with smooth transitions
                    TabView(selection: $state.currentStep) {
                        WelcomeStep(state: state)
                            .tag(OnboardingStep.welcome)

                        PersonalInfoStep(state: state)
                            .tag(OnboardingStep.personalInfo)

                        IncomeStep(state: state)
                            .tag(OnboardingStep.income)

                        HousingStep(state: state)
                            .tag(OnboardingStep.housing)

                        HealthInsuranceStep(state: state)
                            .tag(OnboardingStep.healthInsurance)

                        PhonePlanStep(state: state)
                            .tag(OnboardingStep.phonePlan)

                        TransportStep(state: state)
                            .tag(OnboardingStep.transport)

                        LeasingCreditStep(state: state)
                            .tag(OnboardingStep.leasingCredit)

                        RegistrationStep(state: state) { user in
                            appState.completeOnboarding(user: user)
                        }
                        .tag(OnboardingStep.registration)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .scrollDisabled(true)
                }
            }
            .navigationBarHidden(true)
            .animation(PulpeAnimations.stepTransition, value: state.currentStep)
        }
    }
}

// MARK: - Base Step View

struct OnboardingStepView<Content: View>: View {
    let step: OnboardingStep
    let state: OnboardingState
    let canProceed: Bool
    let onNext: () -> Void
    @ViewBuilder let content: () -> Content

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
                ErrorBanner(message: error.localizedDescription) {
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
        .background(Color.onboardingBackground)
        .dismissKeyboardOnTap()
        .onAppear {
            withAnimation(.easeOut(duration: 0.4).delay(0.2)) {
                contentOpacity = 1
                contentOffset = 0
            }
        }
    }
}

#Preview {
    OnboardingFlow()
        .environment(AppState())
}
