import SwiftUI

struct IncomeStep: View {
    @Bindable var state: OnboardingState
    @State private var showAddIncome = false
    @State private var editingTransaction: OnboardingTransaction?
    /// Drives the keyboard auto-focus on the main income field when the step
    /// appears, so the user can start typing without an extra tap.
    @FocusState private var isMonthlyIncomeFocused: Bool

    private var customIncomes: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .income }
    }

    var body: some View {
        OnboardingStepView(
            step: .income,
            state: state,
            canProceed: state.isIncomeValid,
            subtitle: AppLocale.string("Ton salaire net, ce qui arrive sur ton compte."),
            onNext: { state.nextStep() },
            zone: {
                VStack(spacing: DesignTokens.Spacing.md) {
                    OnboardingBudgetZone(
                        state: state,
                        subtitle: AppLocale.string("\(state.currency.rawValue) · pour l'instant")
                    )
                    Text("Chaque charge et chaque épargne va le réduire.")
                        .font(PulpeTypography.bannerText)
                        .foregroundStyle(Color.heroInkSecondary)
                        .multilineTextAlignment(.center)
                }
            },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                            Text("Tu comptes en francs ou en euros ?")
                                .font(PulpeTypography.labelMedium)
                                .foregroundStyle(Color.textSecondary)
                            SegmentedPicker(
                                selection: Binding(
                                    get: { state.currency },
                                    set: { state.selectCurrency($0) }
                                ),
                                title: nil
                            ) { currency in
                                Text(currency == .chf ? "Francs · CHF" : "Euros · EUR")
                            }
                        }

                        CurrencyField(
                            value: $state.monthlyIncome,
                            hint: "5000",
                            label: AppLocale.string("Revenu mensuel net"),
                            isRequired: true,
                            currency: state.currency,
                            externalFocus: $isMonthlyIncomeFocused
                        )

                        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                            Image(systemName: "lock.fill")
                                .font(PulpeTypography.caption2)
                            Text("Personne d'autre ne voit ces montants, pas même moi qui développe Pulpe.")
                                .font(PulpeTypography.caption)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .foregroundStyle(Color.textTertiary)
                    }

                    if !customIncomes.isEmpty {
                        customIncomesSection
                    }

                    OnboardingAddLink(title: AppLocale.string("Ajouter un autre revenu")) { showAddIncome = true }
                }
                // Open the keyboard on the main income field as the step lands: saves a tap on the
                // screen's only required input. The guard avoids stealing focus back if the user has
                // already moved on to a custom-income sheet within the same task lifecycle.
                .task {
                    guard !isMonthlyIncomeFocused else { return }
                    isMonthlyIncomeFocused = true
                }
            }
        )
        .sheet(isPresented: $showAddIncome) {
            AddCustomExpenseSheet(kind: .income, currency: state.currency, available: state.availableToSpend) { tx in
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
        .trackScreen("Onboarding_Income")
    }

    // MARK: - Custom Incomes

    private var customIncomesSection: some View {
        OnboardingTransactionListSection(
            title: AppLocale.string("Revenus supplémentaires"),
            transactions: customIncomes,
            state: state,
            onEdit: { editingTransaction = $0 }
        )
    }
}

#Preview {
    IncomeStep(state: OnboardingState())
}
