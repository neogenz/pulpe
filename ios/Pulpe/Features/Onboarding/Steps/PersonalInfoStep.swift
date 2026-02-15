import SwiftUI

struct PersonalInfoStep: View {
    let state: OnboardingState
    @FocusState private var isFocused: Bool

    var body: some View {
        OnboardingStepView(
            step: .personalInfo,
            state: state,
            canProceed: state.isFirstNameValid && state.isIncomeValid,
            onNext: { state.nextStep() }
        ) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
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
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
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
    }
}

#Preview {
    PersonalInfoStep(state: OnboardingState())
}
