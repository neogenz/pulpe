import SwiftUI

struct ChargesStep: View {
    @Bindable var state: OnboardingState
    @State private var showAddCharge = false
    @State private var editingTransaction: OnboardingTransaction?
    @State private var suggestionToggleTrigger = false
    @State private var isInsuranceExpanded = false
    @State private var isMobilityExpanded = false

    private var customExpenses: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .expense }
    }

    var body: some View {
        OnboardingStepView(
            step: .charges,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    OnboardingSectionHeader(title: AppLocale.string("Logement"), icon: "house.fill") {
                        CurrencyField(
                            value: $state.housingCosts,
                            hint: "1500",
                            label: AppLocale.string("Loyer mensuel"),
                            currency: state.currency
                        )
                    }

                    OnboardingSectionHeader(
                        title: AppLocale.string("Assurance & Abonnements"),
                        icon: "shield.fill",
                        isExpanded: $isInsuranceExpanded
                    ) {
                        if state.currency == .chf {
                            CurrencyField(
                                value: $state.healthInsurance,
                                hint: "400",
                                label: AppLocale.string("Assurance maladie"),
                                currency: state.currency
                            )
                        }
                        CurrencyField(
                            value: $state.phonePlan,
                            hint: "50",
                            label: AppLocale.string("Forfait téléphone"),
                            currency: state.currency
                        )
                    }

                    OnboardingSectionHeader(
                        title: AppLocale.string("Mobilité & Crédit"),
                        icon: "car.fill",
                        isExpanded: $isMobilityExpanded
                    ) {
                        CurrencyField(
                            value: $state.transportCosts,
                            hint: "100",
                            label: AppLocale.string("Transport (abonnement, essence...)"),
                            currency: state.currency
                        )
                        CurrencyField(
                            value: $state.leasingCredit,
                            hint: "300",
                            label: AppLocale.string("Leasing ou mensualité de crédit"),
                            currency: state.currency
                        )
                    }

                    suggestionsSection

                    if !customExpenses.isEmpty {
                        customChargesSection
                    }

                    addChargeButton

                    if state.totalCharges > 0 {
                        OnboardingRunningTotal(
                            label: AppLocale.string("Total charges"),
                            amount: state.totalCharges,
                            color: .financialExpense,
                            currency: state.currency
                        )
                    }
                }
            }
        )
        .sheet(isPresented: $showAddCharge) {
            AddCustomExpenseSheet(kind: .expense, currency: state.currency) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx, currency: state.currency) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Charges")
        .task {
            // Auto-expand sections that already have data (e.g., returning from BudgetPreview edit)
            if state.healthInsurance != nil || state.phonePlan != nil {
                isInsuranceExpanded = true
            }
            if state.transportCosts != nil || state.leasingCredit != nil {
                isMobilityExpanded = true
            }
        }
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        OnboardingSuggestionGrid(
            suggestions: OnboardingState.chargeSuggestions,
            state: state,
            accentColor: .pulpePrimary,
            toggleTrigger: $suggestionToggleTrigger
        )
    }

    // MARK: - Custom Charges

    private var customChargesSection: some View {
        OnboardingTransactionListSection(
            title: AppLocale.string("Mes prévisions"),
            icon: "list.bullet",
            transactions: customExpenses,
            state: state,
            onEdit: { editingTransaction = $0 }
        )
    }

    // MARK: - Add Button

    private var addChargeButton: some View {
        Button {
            showAddCharge = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Ajouter une charge")
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
    }
}

#Preview {
    ChargesStep(state: OnboardingState())
}
