import SwiftUI

struct FirstNameStep: View {
    private enum FormField: Hashable {
        case firstName
    }

    @Bindable var state: OnboardingState
    @FocusState private var focusedField: FormField?

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
                        isFilled: state.isFirstNameValid,
                        focusBinding: $focusedField,
                        focusField: .firstName
                    )
                    .textContentType(.givenName)
                    .textInputAutocapitalization(.words)
                    .accessibilityLabel("Prénom")
                    .accessibilityHint("Saisis ton prénom")
                }
                .task {
                    focusedField = .firstName
                }
            }
        )
        .trackScreen("Onboarding_FirstName")
    }
}

#Preview {
    FirstNameStep(state: OnboardingState())
}
