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
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    suggestionsSection

                    if !customSavings.isEmpty {
                        customSavingsSection
                    }

                    addSavingButton

                    if state.totalSavings > 0 {
                        OnboardingRunningTotal(
                            label: "Total épargne",
                            amount: state.totalSavings,
                            color: .financialSavings
                        )
                    }
                }
            }
        )
        .sheet(isPresented: $showAddSaving) {
            AddCustomExpenseSheet(defaultKind: .saving, availableKinds: [.saving]) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx, availableKinds: [.saving]) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Savings")
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        OnboardingSuggestionGrid(
            suggestions: OnboardingState.savingSuggestions,
            state: state,
            accentColor: .financialSavings,
            toggleTrigger: $suggestionToggleTrigger
        )
    }

    // MARK: - Custom Savings

    private var customSavingsSection: some View {
        OnboardingSectionHeader(title: "Mes épargnes", icon: "list.bullet") {
            ForEach(customSavings) { tx in
                if tx.id != customSavings.first?.id {
                    Divider().opacity(DesignTokens.Opacity.accent)
                }
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

    // MARK: - Add Button

    private var addSavingButton: some View {
        Button {
            showAddSaving = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Ajouter une épargne")
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.financialSavings)
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
    }
}

#Preview {
    SavingsStep(state: OnboardingState())
}
