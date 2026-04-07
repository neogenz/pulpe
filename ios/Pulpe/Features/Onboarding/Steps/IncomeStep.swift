import SwiftUI

struct IncomeStep: View {
    @Bindable var state: OnboardingState
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
                    CurrencyField(
                        value: $state.monthlyIncome,
                        hint: "5000",
                        label: "Revenu mensuel net"
                    )

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
            AddCustomExpenseSheet(defaultKind: .income, availableKinds: [.income]) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx, availableKinds: [.income]) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Income")
    }

    // MARK: - Custom Incomes

    private var customIncomesSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.financialIncome)
                Text("Revenus supplémentaires")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }

            ForEach(customIncomes) { tx in
                OnboardingTransactionRow(
                    transaction: tx,
                    onEdit: { editingTransaction = tx },
                    onRemove: {
                        guard let index = state.customTransactions.firstIndex(
                            where: { $0.id == tx.id }
                        ) else { return }
                        withAnimation(DesignTokens.Animation.defaultSpring) {
                            state.removeCustomTransaction(at: index)
                        }
                    }
                )
            }
        }
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
}
