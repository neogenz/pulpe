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
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.textPrimaryOnboarding)

                    TextField("Ton prénom", text: Binding(
                        get: { state.firstName },
                        set: { state.firstName = $0 }
                    ))
                    .textContentType(.givenName)
                    .autocapitalization(.words)
                    .focused($isFocused)
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.authInputText)
                    .padding(DesignTokens.Spacing.lg)
                    .background {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.authInputBackground)
                            .overlay {
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .strokeBorder(Color.authInputBorder, lineWidth: 1)
                            }
                    }
                    .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
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
