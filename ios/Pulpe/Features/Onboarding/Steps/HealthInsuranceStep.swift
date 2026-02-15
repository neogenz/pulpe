import SwiftUI

struct HealthInsuranceStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .healthInsurance,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.healthInsurance },
                    set: { state.healthInsurance = $0 }
                ),
                hint: "400",
                label: "Assurance maladie"
            )
        }
    }
}

#Preview {
    HealthInsuranceStep(state: OnboardingState())
}
