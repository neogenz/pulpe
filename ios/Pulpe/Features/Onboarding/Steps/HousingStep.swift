import SwiftUI

struct HousingStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .housing,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.housingCosts },
                    set: { state.housingCosts = $0 }
                ),
                hint: "1500",
                label: "Loyer mensuel"
            )
        }
    }
}

#Preview {
    HousingStep(state: OnboardingState())
}
