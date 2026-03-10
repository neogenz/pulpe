import SwiftUI

struct PersonalInfoStep: View {
    @Bindable var state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid && state.isIncomeValid,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
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
                    }

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("Devise")
                            .font(PulpeTypography.inputLabel)
                            .foregroundStyle(Color.textPrimaryOnboarding)

                        Picker("Devise", selection: $state.currency) {
                            Text("CHF").tag("CHF")
                            Text("EUR").tag("EUR")
                        }
                        .pickerStyle(.segmented)
                    }

                    CurrencyField(
                        value: $state.monthlyIncome,
                        hint: "5000",
                        label: "Revenu mensuel net",
                        currency: state.currency
                    )
                }
                .task {
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
