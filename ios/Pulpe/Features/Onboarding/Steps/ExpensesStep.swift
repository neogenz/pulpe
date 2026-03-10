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
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    expenseSection("Logement", icon: "house.fill") {
                        CurrencyField(
                            value: $state.housingCosts, hint: "1500",
                            label: "Loyer mensuel", currency: state.currency
                        )
                    }

                    expenseSection("Assurance & Abonnements", icon: "heart.text.square.fill") {
                        CurrencyField(
                            value: $state.healthInsurance, hint: "400",
                            label: "Assurance maladie", currency: state.currency
                        )
                    }

                    expenseSection("Mobilité & Crédit", icon: "car.fill") {
                        CurrencyField(
                            value: $state.phonePlan, hint: "50",
                            label: "Forfait téléphone", currency: state.currency
                        )
                        CurrencyField(
                            value: $state.transportCosts, hint: "100",
                            label: "Transport (abonnement, essence...)",
                            currency: state.currency
                        )
                        CurrencyField(
                            value: $state.leasingCredit, hint: "300",
                            label: "Leasing ou mensualité de crédit",
                            currency: state.currency
                        )
                    }
                }
            }
        )
        .trackScreen("Onboarding_Expenses")
    }

    private func expenseSection<Content: View>(
        _ title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: icon)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.onboardingSectionIcon)
                Text(title)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }

            content()
        }
    }
}

#Preview {
    ExpensesStep(state: OnboardingState())
}
