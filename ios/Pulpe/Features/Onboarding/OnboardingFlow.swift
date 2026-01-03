import SwiftUI

/// Main onboarding flow coordinator
struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @State private var state = OnboardingState()

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Progress bar (except welcome)
                    if state.currentStep.showProgressBar {
                        ProgressView(value: state.progressPercentage, total: 100)
                            .tint(.accentColor)
                            .padding(.horizontal)
                            .padding(.top, 8)
                    }

                    // Step content
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
                    .animation(.easeInOut(duration: 0.3), value: state.currentStep)
                }
            }
            .navigationBarHidden(true)
            .onAppear {
                state.loadFromStorage()
            }
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

    var body: some View {
        VStack(spacing: 24) {
            // Title section
            VStack(spacing: 8) {
                Text(step.title)
                    .font(.title)
                    .fontWeight(.bold)

                Text(step.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if step.isOptional {
                    Text("Optionnel")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(.secondary.opacity(0.1), in: Capsule())
                }
            }
            .padding(.top, 32)

            // Content
            content()
                .padding(.horizontal)

            Spacer()

            // Error display
            if let error = state.error {
                ErrorBanner(message: error.localizedDescription) {
                    state.error = nil
                }
                .padding(.horizontal)
            }

            // Navigation buttons
            VStack(spacing: 12) {
                // Next button
                Button {
                    onNext()
                } label: {
                    HStack {
                        if state.isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text(step == .registration ? "Créer mon compte" : "Continuer")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(canProceed ? Color.accentColor : Color.secondary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canProceed || state.isLoading)

                // Back button (except welcome)
                if step != .welcome {
                    Button("Retour") {
                        state.previousStep()
                    }
                    .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
        .dismissKeyboardOnTap()
    }
}

#Preview {
    OnboardingFlow()
        .environment(AppState())
}
