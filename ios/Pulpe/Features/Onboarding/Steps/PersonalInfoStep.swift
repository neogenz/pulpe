import SwiftUI

struct PersonalInfoStep: View {
    @Bindable var state: OnboardingState
    @FocusState private var isNameFocused: Bool
    @FocusState private var isIncomeFocused: Bool

    private var shouldShowNameField: Bool {
        !state.isSocialSignup
    }

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.canProceed(from: .personalInfo),
            onNext: { state.nextStep() },
            titleOverride: shouldShowNameField ? nil : OnboardingStep.personalInfo.socialTitle,
            subtitleOverride: shouldShowNameField ? nil : OnboardingStep.personalInfo.socialSubtitle,
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
                                isFocused: isNameFocused,
                                isFilled: state.isFirstNameValid
                            )
                            .textContentType(.givenName)
                            .textInputAutocapitalization(.words)
                            .focused($isNameFocused)
                            .accessibilityLabel("Prénom")
                            .accessibilityHint("Saisis ton prénom")
                        }
                    }

                    CurrencyField(
                        value: $state.monthlyIncome,
                        hint: "5000",
                        label: "Revenu mensuel net",
                        externalFocus: $isIncomeFocused
                    )
                }
                .task {
                    if shouldShowNameField {
                        isNameFocused = true
                    } else {
                        isIncomeFocused = true
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
