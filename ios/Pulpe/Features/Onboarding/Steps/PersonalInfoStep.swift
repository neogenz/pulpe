import SwiftUI

struct PersonalInfoStep: View {
    @Bindable var state: OnboardingState
    @FocusState private var isFocused: Bool

    private var shouldShowNameField: Bool {
        !(state.isSocialSignup && state.isFirstNameValid)
    }

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid && state.isIncomeValid,
            onNext: { state.nextStep() },
            titleOverride: shouldShowNameField ? nil : "Ton revenu",
            subtitleOverride: shouldShowNameField ? nil : "Indique ton revenu mensuel",
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    if shouldShowNameField {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                            Text("Prénom")
                                .font(PulpeTypography.inputLabel)
                                .foregroundStyle(Color.textPrimaryOnboarding)

                            AuthTextField(
                                prompt: "Ton prénom",
                                text: $state.firstName,
                                systemImage: "person",
                                isFocused: isFocused,
                                isFilled: state.isFirstNameValid
                            )
                            .textContentType(.givenName)
                            .textInputAutocapitalization(.words)
                            .focused($isFocused)
                            .accessibilityLabel("Prénom")
                            .accessibilityHint("Saisis ton prénom")
                        }
                    }

                    CurrencyField(
                        value: $state.monthlyIncome,
                        hint: "5000",
                        label: "Revenu mensuel net"
                    )
                }
                .task {
                    if shouldShowNameField {
                        isFocused = true
                    }
                }
            }
        )
        .trackScreen("Onboarding_PersonalInfo")
    }
}

#Preview {
    PersonalInfoStep(state: OnboardingState())
}
