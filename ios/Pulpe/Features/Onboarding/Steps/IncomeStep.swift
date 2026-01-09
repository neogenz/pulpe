import SwiftUI

struct IncomeStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .income,
            state: state,
            canProceed: state.isIncomeValid,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.monthlyIncome },
                    set: { state.monthlyIncome = $0 }
                ),
                placeholder: "5000",
                label: "Revenu mensuel net"
            )
        }
    }
}

#Preview {
    IncomeStep(state: OnboardingState())
}
