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
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxxl) {
                    expenseSection("Logement") {
                        CurrencyField(value: $state.housingCosts, hint: "1500", label: "Loyer mensuel")
                    }

                    expenseSection("Assurance & Abonnements") {
                        CurrencyField(value: $state.healthInsurance, hint: "400", label: "Assurance maladie")
                        CurrencyField(value: $state.phonePlan, hint: "50", label: "Forfait t\u{00e9}l\u{00e9}phone")
                    }

                    expenseSection("Mobilit\u{00e9} & Cr\u{00e9}dit") {
                        CurrencyField(
                            value: $state.transportCosts, hint: "100",
                            label: "Transport (abonnement, essence...)"
                        )
                        CurrencyField(
                            value: $state.leasingCredit, hint: "300",
                            label: "Leasing ou mensualit\u{00e9} de cr\u{00e9}dit"
                        )
                    }
                }
            }
        )
        .trackScreen("Onboarding_Expenses")
    }

    private func expenseSection<Content: View>(
        _ title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text(title)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondaryOnboarding)

            content()
        }
    }
}

#Preview {
    ExpensesStep(state: OnboardingState())
}
