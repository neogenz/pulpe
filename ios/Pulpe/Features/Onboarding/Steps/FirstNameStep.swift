import SwiftUI

struct FirstNameStep: View {
    @Bindable var state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .firstName,
            state: state,
            canProceed: state.isFirstNameValid,
            onNext: { state.nextStep() },
            content: {
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
                .task {
                    isFocused = true
                }
            }
        )
        .trackScreen("Onboarding_FirstName")
    }
}

#Preview {
    FirstNameStep(state: OnboardingState())
}
