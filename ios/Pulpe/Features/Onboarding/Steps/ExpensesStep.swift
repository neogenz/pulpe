import SwiftUI

struct ExpensesStep: View {
    @Bindable var state: OnboardingState
    @State private var showAddCustomExpense = false
    @State private var suggestionToggleTrigger = false

    var body: some View {
        OnboardingStepView(
            step: .expenses,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() },
            content: {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sectionGap) {
                    expenseSection("Logement", icon: "house.fill") {
                        CurrencyField(value: $state.housingCosts, hint: "1500", label: "Loyer mensuel")
                    }

                    expenseSection("Assurance & Abonnements", icon: "heart.text.square.fill") {
                        CurrencyField(value: $state.healthInsurance, hint: "400", label: "Assurance maladie")
                        CurrencyField(value: $state.phonePlan, hint: "50", label: "Forfait t\u{00e9}l\u{00e9}phone")
                    }

                    expenseSection("Mobilit\u{00e9} & Cr\u{00e9}dit", icon: "car.fill") {
                        CurrencyField(
                            value: $state.transportCosts, hint: "100",
                            label: "Transport (abonnement, essence...)"
                        )
                        CurrencyField(
                            value: $state.leasingCredit, hint: "300",
                            label: "Leasing ou mensualit\u{00e9} de cr\u{00e9}dit"
                        )
                    }

                    suggestionsSection

                    if !state.customTransactions.isEmpty {
                        customTransactionsSection
                    }

                    addCustomExpenseButton
                }
            }
        )
        .sheet(isPresented: $showAddCustomExpense) {
            AddCustomExpenseSheet { tx in
                state.addCustomTransaction(tx)
            }
        }
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

    // MARK: - Suggestions

    private var suggestionsSection: some View {
        expenseSection("Suggestions", icon: "lightbulb.fill") {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 140), spacing: DesignTokens.Spacing.sm)],
                spacing: DesignTokens.Spacing.sm
            ) {
                ForEach(OnboardingState.suggestions, id: \.name) { suggestion in
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
                                    isSelected
                                        ? Color.textOnPrimary.opacity(DesignTokens.Opacity.strong)
                                        : Color.onSurfaceVariant
                                )
                        }
                        .font(PulpeTypography.labelMedium)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(isSelected ? Color.pulpePrimary : Color.surfaceContainer)
                        .foregroundStyle(isSelected ? Color.textOnPrimary : Color.textPrimary)
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

    // MARK: - Custom Transactions

    private var customTransactionsSection: some View {
        expenseSection("Mes dépenses", icon: "list.bullet") {
            ForEach(Array(state.customTransactions.enumerated()), id: \.offset) { index, tx in
                HStack {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text(tx.name)
                            .font(PulpeTypography.bodyLarge)
                            .foregroundStyle(Color.textPrimary)
                        Text(tx.expenseType.label)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.textTertiary)
                    }

                    Spacer()

                    Text(tx.amount.asCHF)
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textPrimary)

                    Button {
                        withAnimation(DesignTokens.Animation.defaultSpring) {
                            state.removeCustomTransaction(at: index)
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.onSurfaceVariant)
                    }
                    .iconButtonStyle()
                }
                .padding(.vertical, DesignTokens.Spacing.xs)
            }
        }
    }

    private var addCustomExpenseButton: some View {
        Button {
            showAddCustomExpense = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Ajouter une dépense")
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
    ExpensesStep(state: OnboardingState())
}
