import SwiftUI

struct SavingsStep: View {
    @Bindable var state: OnboardingState
    @State private var showAddSaving = false
    @State private var editingTransaction: OnboardingTransaction?
    @State private var suggestionToggleTrigger = false

    private var customSavings: [OnboardingTransaction] {
        state.customTransactions.filter { $0.type == .saving }
    }

    var body: some View {
        OnboardingStepView(
            step: .savings,
            state: state,
            canProceed: true,
            subtitle: AppLocale.string("""
                Ce que tu veux garder chaque mois. Tu pourras le relier à un objectif \
                plus tard.
                """),
            onNext: { state.nextStep() },
            zone: { OnboardingBudgetZone(state: state, legend: .savings) },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    suggestionsSection

                    if !customSavings.isEmpty {
                        customSavingsSection
                    }

                    OnboardingAddLink(title: AppLocale.string("Ajouter une épargne")) { showAddSaving = true }
                }
            }
        )
        .sheet(isPresented: $showAddSaving) {
            AddCustomExpenseSheet(kind: .saving, currency: state.currency, available: state.availableToSpend) { tx in
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
        .trackScreen("Onboarding_Savings")
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        OnboardingSuggestionGrid(
            suggestions: OnboardingState.savingSuggestions(for: state.currency),
            state: state,
            toggleTrigger: $suggestionToggleTrigger
        )
    }

    // MARK: - Custom Savings

    private var customSavingsSection: some View {
        OnboardingTransactionListSection(
            title: AppLocale.string("Mes épargnes"),
            transactions: customSavings,
            state: state,
            onEdit: { editingTransaction = $0 }
        )
    }
}

#Preview {
    SavingsStep(state: OnboardingState())
}
