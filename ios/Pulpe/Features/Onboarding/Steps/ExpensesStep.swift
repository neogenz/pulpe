import SwiftUI

struct ExpensesStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .expenses,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                CurrencyField(
                    value: Binding(
                        get: { state.housingCosts },
                        set: { state.housingCosts = $0 }
                    ),
                    hint: "1500",
                    label: "Loyer mensuel"
                )

                CurrencyField(
                    value: Binding(
                        get: { state.healthInsurance },
                        set: { state.healthInsurance = $0 }
                    ),
                    hint: "400",
                    label: "Assurance maladie"
                )

                CurrencyField(
                    value: Binding(
                        get: { state.phonePlan },
                        set: { state.phonePlan = $0 }
                    ),
                    hint: "50",
                    label: "Forfait téléphone"
                )

                CurrencyField(
                    value: Binding(
                        get: { state.transportCosts },
                        set: { state.transportCosts = $0 }
                    ),
                    hint: "100",
                    label: "Transport (abonnement, essence...)"
                )

                CurrencyField(
                    value: Binding(
                        get: { state.leasingCredit },
                        set: { state.leasingCredit = $0 }
                    ),
                    hint: "300",
                    label: "Leasing ou mensualité de crédit"
                )
            }
        }
    }
}

#Preview {
    ExpensesStep(state: OnboardingState())
}
