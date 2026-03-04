import SwiftUI

struct PersonalInfoStep: View {
    let state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid && state.isIncomeValid,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Prénom")
                            .font(PulpeTypography.inputLabel)
                            .foregroundStyle(Color.textPrimaryOnboarding)

                        AuthTextField(
                            prompt: "Ton prénom",
                            text: Binding(
                                get: { state.firstName },
                                set: { state.firstName = $0 }
                            ),
                            systemImage: "person",
                            isFocused: isFocused,
                            isFilled: state.isFirstNameValid
                        )
                        .textContentType(.givenName)
                        .textInputAutocapitalization(.words)
                        .focused($isFocused)
                    }

                    CurrencyField(
                        value: Binding(
                            get: { state.monthlyIncome },
                            set: { state.monthlyIncome = $0 }
                        ),
                        hint: "5000",
                        label: "Revenu mensuel net"
                    )
                }
                .onAppear {
                    isFocused = true
                }
            }
        )
        .trackScreen("Onboarding_PersonalInfo")
    }
}

#Preview {
    PersonalInfoStep(state: OnboardingState())
}
