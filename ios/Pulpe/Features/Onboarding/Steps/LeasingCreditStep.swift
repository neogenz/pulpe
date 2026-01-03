import SwiftUI

struct LeasingCreditStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .leasingCredit,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.leasingCredit },
                    set: { state.leasingCredit = $0 }
                ),
                placeholder: "300",
                label: "Leasing ou mensualité de crédit"
            )
        }
    }
}

#Preview {
    LeasingCreditStep(state: OnboardingState())
}
