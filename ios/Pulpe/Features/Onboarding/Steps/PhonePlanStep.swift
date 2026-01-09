import SwiftUI

struct PhonePlanStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .phonePlan,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.phonePlan },
                    set: { state.phonePlan = $0 }
                ),
                placeholder: "50",
                label: "Forfait téléphone"
            )
        }
    }
}

#Preview {
    PhonePlanStep(state: OnboardingState())
}
