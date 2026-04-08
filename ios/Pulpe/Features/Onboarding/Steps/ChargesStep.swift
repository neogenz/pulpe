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
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    OnboardingSectionHeader(title: "Logement", icon: "house.fill") {
                        CurrencyField(value: $state.housingCosts, hint: "1500", label: "Loyer mensuel")
                    }

                    OnboardingSectionHeader(title: "Assurance & Abonnements", icon: "heart.text.square.fill") {
                        CurrencyField(value: $state.healthInsurance, hint: "400", label: "Assurance maladie")
                        CurrencyField(value: $state.phonePlan, hint: "50", label: "Forfait téléphone")
                    }

                    OnboardingSectionHeader(title: "Mobilité & Crédit", icon: "car.fill") {
                        CurrencyField(
                            value: $state.transportCosts, hint: "100",
                            label: "Transport (abonnement, essence...)"
                        )
                        CurrencyField(
                            value: $state.leasingCredit, hint: "300",
                            label: "Leasing ou mensualité de crédit"
                        )
                    }

                    suggestionsSection

                    if !customExpenses.isEmpty {
                        customChargesSection
                    }

                    addChargeButton

                    if state.totalCharges > 0 {
                        OnboardingRunningTotal(
                            label: "Total charges",
                            amount: state.totalCharges,
                            color: .financialExpense
                        )
                    }
                }
            }
        )
        .sheet(isPresented: $showAddCharge) {
            AddCustomExpenseSheet(defaultKind: .expense, availableKinds: [.expense]) { tx in
                state.addCustomTransaction(tx)
            }
            .standardSheetPresentation()
        }
        .sheet(item: $editingTransaction) { tx in
            AddCustomExpenseSheet(editing: tx, availableKinds: [.expense]) { updated in
                state.replaceCustomTransaction(id: tx.id, with: updated)
            }
            .standardSheetPresentation()
        }
        .trackScreen("Onboarding_Charges")
    }

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        OnboardingSectionHeader(title: "Suggestions", icon: "lightbulb.fill") {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 155), spacing: DesignTokens.Spacing.sm)],
                spacing: DesignTokens.Spacing.sm
            ) {
                ForEach(OnboardingState.chargeSuggestions, id: \.name) { suggestion in
                    let isSelected = state.isSuggestionSelected(suggestion)
                    Button {
                        withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                            state.toggleSuggestion(suggestion)
                        }
                        suggestionToggleTrigger.toggle()
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Text(suggestion.name)
                                .lineLimit(1)
                            Text(suggestion.amount.asCompactCHF)
                                .foregroundStyle(
                                    isSelected ? Color.onPrimaryContainer : Color.onSurfaceVariant
                                )
                        }
                        .font(PulpeTypography.labelMedium)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(isSelected ? Color.primaryContainer : Color.surfaceContainer)
                        .foregroundStyle(isSelected ? Color.onPrimaryContainer : Color.textPrimary)
                        .overlay {
                            Capsule()
                                .strokeBorder(
                                    isSelected ? Color.pulpePrimary : Color.clear,
                                    lineWidth: DesignTokens.BorderWidth.thin
                                )
                        }
                        .clipShape(Capsule())
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Capsule())
                    .plainPressedButtonStyle()
                    .accessibilityLabel("\(suggestion.name), \(suggestion.amount.asCompactCHF)")
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .sensoryFeedback(.selection, trigger: suggestionToggleTrigger)
        }
    }

    // MARK: - Custom Charges

    private var customChargesSection: some View {
        OnboardingSectionHeader(title: "Mes prévisions", icon: "list.bullet") {
            ForEach(customExpenses) { tx in
                if tx.id != customExpenses.first?.id {
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
