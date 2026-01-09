import SwiftUI

struct TransportStep: View {
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .transport,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            CurrencyField(
                value: Binding(
                    get: { state.transportCosts },
                    set: { state.transportCosts = $0 }
                ),
                placeholder: "100",
                label: "Transport (abonnement, essence...)"
            )
        }
    }
}

#Preview {
    TransportStep(state: OnboardingState())
}
