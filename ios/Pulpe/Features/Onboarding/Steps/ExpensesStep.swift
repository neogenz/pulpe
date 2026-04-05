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
            .standardSheetPresentation()
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
                columns: [GridItem(.adaptive(minimum: 155), spacing: DesignTokens.Spacing.sm)],
                spacing: DesignTokens.Spacing.sm
            ) {
                ForEach(OnboardingState.suggestions, id: \.name) { suggestion in
                    let isSelected = state.isSuggestionSelected(suggestion)
                    let isSaving = suggestion.type == .saving
                    let accentColor = isSaving ? Color.financialSavings : Color.pulpePrimary
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
                                        ? Color.onPrimaryContainer
                                        : Color.onSurfaceVariant
                                )
                        }
                        .font(PulpeTypography.labelMedium)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(
                            isSelected ? Color.primaryContainer : Color.surfaceContainer
                        )
                        .foregroundStyle(
                            isSelected ? Color.onPrimaryContainer : Color.textPrimary
                        )
                        .overlay {
                            Capsule()
                                .strokeBorder(
                                    isSelected ? accentColor : Color.clear,
                                    lineWidth: DesignTokens.BorderWidth.thin
                                )
                        }
                        .clipShape(Capsule())
                    }
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Capsule())
                    .plainPressedButtonStyle()
                    .accessibilityLabel(
                        "\(suggestion.name), \(suggestion.amount.asCompactCHF)"
                    )
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
            .sensoryFeedback(.selection, trigger: suggestionToggleTrigger)
        }
    }

    // MARK: - Custom Transactions

    private var customTransactionsSection: some View {
        expenseSection("Mes prévisions", icon: "list.bullet") {
            ForEach(state.customTransactions) { tx in
                if tx.id != state.customTransactions.first?.id {
                    Divider().opacity(DesignTokens.Opacity.accent)
                }
                CustomTransactionRow(
                    transaction: tx,
                    onAmountChange: { newAmount in
                        guard let index = state.customTransactions.firstIndex(
                            where: { $0.id == tx.id }
                        ) else { return }
                        state.updateCustomTransactionAmount(at: index, amount: newAmount)
                    },
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

    private var addCustomExpenseButton: some View {
        Button {
            showAddCustomExpense = true
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus.circle.fill")
                Text("Ajouter une prévision")
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
    }
}

// MARK: - Custom Transaction Row

private struct CustomTransactionRow: View {
    let transaction: OnboardingTransaction
    let onAmountChange: (Decimal) -> Void
    let onRemove: () -> Void

    @State private var amountText: String = ""
    @FocusState private var isAmountFocused: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(transaction.name)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                Text(transaction.type.label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(transaction.type.color)
            }

            Spacer()

            HStack(spacing: DesignTokens.Spacing.xs) {
                TextField("0", text: $amountText)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(PulpeTypography.bodyLarge)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .frame(width: 70)
                    .focused($isAmountFocused)
                    .onChange(of: isAmountFocused) { _, focused in
                        if !focused { commitAmount() }
                    }
                    .onSubmit { commitAmount() }

                Text("CHF")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .padding(.horizontal, DesignTokens.Spacing.sm)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .background(
                Color.surfaceContainer,
                in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm, style: .continuous)
                    .strokeBorder(
                        isAmountFocused ? Color.pulpePrimary.opacity(0.45) : Color.outlineVariant,
                        lineWidth: DesignTokens.BorderWidth.hairline
                    )
            }

            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Color.onSurfaceVariant)
            }
            .iconButtonStyle()
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .onAppear {
            amountText = formatAmount(transaction.amount)
        }
        .onChange(of: transaction.amount) { _, newValue in
            if !isAmountFocused {
                amountText = formatAmount(newValue)
            }
        }
    }

    private func commitAmount() {
        if let value = amountText.parsedAsAmount, value > 0 {
            onAmountChange(value)
        } else {
            amountText = formatAmount(transaction.amount)
        }
    }

    private func formatAmount(_ value: Decimal) -> String {
        Formatters.amountInput.string(from: value as NSDecimalNumber) ?? ""
    }
}

#Preview {
    ExpensesStep(state: OnboardingState())
}
