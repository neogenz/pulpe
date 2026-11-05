import SwiftUI

struct ChargesStep: View {
    @Bindable var state: OnboardingState
    @State private var showAddCharge = false
    @State private var editingTransaction: OnboardingTransaction?
    @State private var suggestionToggleTrigger = false

    private var customExpenses: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .expense }
    }

    var body: some View {
        OnboardingStepView(
            step: .charges,
            state: state,
            canProceed: true,
            subtitle: AppLocale.string("""
                Ce qui part chaque mois, quoi qu'il arrive. Laisse vide ce qui ne te concerne pas.
                """),
            onNext: { state.nextStep() },
            zone: { OnboardingBudgetZone(state: state, legend: .charges) },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    OnboardingSectionHeader(title: AppLocale.string("Logement")) {
                        FormCard {
                            amountRow(AppLocale.string("Loyer"), $state.housingCosts)
                        }
                    }

                    OnboardingSectionHeader(title: AppLocale.string("Assurances et abonnements")) {
                        FormCard {
                            if state.currency == .chf {
                                amountRow(AppLocale.string("Assurance maladie"), $state.healthInsurance)
                                FormRowDivider()
                            }
                            amountRow(AppLocale.string("Forfait téléphone"), $state.phonePlan)
                        }
                    }

                    OnboardingSectionHeader(title: AppLocale.string("Mobilité et crédit")) {
                        FormCard {
                            amountRow(AppLocale.string("Transport"), $state.transportCosts)
                            FormRowDivider()
                            amountRow(AppLocale.string("Leasing ou crédit"), $state.leasingCredit)
                        }
                        Text("Abonnement, essence, mensualité de crédit.")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textSecondary)
                    }

                    suggestionsSection

                    if !customExpenses.isEmpty {
                        customChargesSection
                    }

                    OnboardingAddLink(title: AppLocale.string("Ajouter une charge")) { showAddCharge = true }
                }
            }
        )
        .sheet(isPresented: $showAddCharge) {
            AddCustomExpenseSheet(kind: .expense, currency: state.currency, available: state.availableToSpend) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx, currency: state.currency, available: state.availableToSpend) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Charges")
    }

    private func amountRow(_ label: String, _ value: Binding<Decimal?>) -> some View {
        OnboardingAmountRow(label: label, value: value, currency: state.currency)
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        OnboardingSuggestionGrid(
            suggestions: OnboardingState.chargeSuggestions,
            state: state,
            toggleTrigger: $suggestionToggleTrigger
        )
    }

    // MARK: - Custom Charges

    private var customChargesSection: some View {
        OnboardingTransactionListSection(
            title: AppLocale.string("Mes prévisions"),
            transactions: customExpenses,
            state: state,
            onEdit: { editingTransaction = $0 }
        )
    }
}

#Preview {
    ChargesStep(state: OnboardingState())
}
