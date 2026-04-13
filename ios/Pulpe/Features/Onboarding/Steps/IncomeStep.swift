import SwiftUI

struct IncomeStep: View {
    @Bindable var state: OnboardingState
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @State private var showAddIncome = false
    @State private var editingTransaction: OnboardingTransaction?

    private var customIncomes: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .income }
    }

    var body: some View {
        OnboardingStepView(
            step: .income,
            state: state,
            canProceed: state.isIncomeValid,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                        if featureFlagsStore.isMultiCurrencyEnabled {
                            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                                Text("Devise")
                                    .font(PulpeTypography.inputLabel)
                                    .foregroundStyle(Color.textPrimaryOnboarding)

                                Picker("Devise", selection: $state.currency) {
                                    ForEach(SupportedCurrency.allCases) { currency in
                                        Text(currency.rawValue).tag(currency)
                                    }
                                }
                                .pickerStyle(.segmented)
                            }
                        }

                        CurrencyField(
                            value: $state.monthlyIncome,
                            hint: "5000",
                            label: "Revenu mensuel net",
                            currency: state.currency
                        )

                        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                            Image(systemName: "lock.fill")
                                .font(PulpeTypography.caption2)
                            Text("Personne d'autre ne voit ces montants — pas même moi qui développe Pulpe.")
                                .font(PulpeTypography.caption)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .foregroundStyle(Color.textTertiaryOnboarding)
                    }

                    if !customIncomes.isEmpty {
                        customIncomesSection
                    }

                    addIncomeButton

                    if state.totalIncome > 0 {
                        OnboardingRunningTotal(
                            label: "Total revenus",
                            amount: state.totalIncome,
                            color: .financialIncome
                        )
                    }
                }
            }
        )
        .sheet(isPresented: $showAddIncome) {
            AddCustomExpenseSheet(kind: .income) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Income")
    }

    // MARK: - Custom Incomes

    private var customIncomesSection: some View {
        OnboardingTransactionListSection(
            title: "Revenus supplémentaires",
            icon: "arrow.down.circle.fill",
            transactions: customIncomes,
            state: state,
            onEdit: { editingTransaction = $0 }
        )
    }

    private var addIncomeButton: some View {
        Button {
            showAddIncome = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Ajouter un revenu")
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
    IncomeStep(state: OnboardingState())
        .environment(FeatureFlagsStore())
}
