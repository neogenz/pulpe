import SwiftUI

struct ExpensesStep: View {
    @Bindable var state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .expenses,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    CurrencyField(value: $state.housingCosts, hint: "1500", label: "Loyer mensuel")
                    CurrencyField(value: $state.healthInsurance, hint: "400", label: "Assurance maladie")
                    CurrencyField(value: $state.phonePlan, hint: "50", label: "Forfait téléphone")
                    CurrencyField(
                        value: $state.transportCosts, hint: "100", label: "Transport (abonnement, essence...)"
                    )
                    CurrencyField(value: $state.leasingCredit, hint: "300", label: "Leasing ou mensualité de crédit")
                }
            }
        )
        .trackScreen("Onboarding_Expenses")
    }
}

#Preview {
    ExpensesStep(state: OnboardingState())
}
