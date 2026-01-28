import SwiftUI

struct PersonalInfoStep: View {
    let state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid,
            onNext: { state.nextStep() }
        ) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Prénom")
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(.secondary)

                TextField("Ton prénom", text: Binding(
                    get: { state.firstName },
                    set: { state.firstName = $0 }
                ))
                .textContentType(.givenName)
                .autocapitalization(.words)
                .focused($isFocused)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
                .onSubmit {
                    if state.isFirstNameValid {
                        state.nextStep()
                    }
                }
            }
            .onAppear {
                isFocused = true
            }
        }
    }
}

#Preview {
    PersonalInfoStep(state: OnboardingState())
}
