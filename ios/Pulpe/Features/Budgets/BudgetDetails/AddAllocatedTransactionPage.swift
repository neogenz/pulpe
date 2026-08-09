import SwiftUI

/// Push page for adding a new transaction allocated to a specific budget line.
///
/// Replaces the legacy `AddAllocatedTransactionSheet`. Resolves the parent
/// `BudgetLine` reactively from `BudgetDetailsViewModel` (injected via
/// `.environment(viewModel)` on the navigation destination); when the line is
/// removed externally the page auto-pops.
struct AddAllocatedTransactionPage: View {
    let lineId: String

    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(BudgetDetailsProjector.self) private var projector
    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore

    @State private var name = ""
    @State private var amount: Decimal?
    @State private var amountText = ""
    @State private var transactionDate: Date = .now
    @State private var isChecked = false
    /// `nil` until the user explicitly picks a currency. The body resolves
    /// the effective currency lazily from `userSettingsStore.currency` on the
    /// first render, so the picker / hero amount don't flash with a hardcoded
    /// `.chf` default for users on a different currency.
    @State private var inputCurrency: SupportedCurrency?
    @State private var error: Error?
    @State private var isLoading = false
    @State private var submitSuccessTrigger = false
    @State private var didAutofocus = false
    @State private var didPrefill = false
    @State private var selectedTagIds: Set<String> = []
    /// The goal's confirmed balance, read once the page opens so the user sees
    /// the ceiling they are typing against. `nil` while it loads or if it fails:
    /// the server remains the authority on what can actually be taken out.
    @State private var confirmedBalance: Decimal?
    @FocusState private var focusedField: AmountDescriptionField?

    private let conversionService = CurrencyConversionService.shared

    // MARK: - Derived

    private var budgetLine: BudgetLine? {
        coordinator.dataStore.budgetLines.first { $0.id == lineId }
    }

    /// PUL-329 v2 — non-nil only when this line announces a withdrawal from a
    /// still-existing goal. Everything the realization header and the prefill
    /// need; the goal itself is never picked here, the server inherits it.
    private var realization: AddAllocatedTransactionLogic.RealizationPrefill? {
        guard let budgetLine else { return nil }
        // Projector-indexed consumption, like the line detail page's hero. The
        // zero fallback covers the frame where the page renders before the
        // projector publishes.
        let consumption = projector.screenState.consumptionByLineId[lineId]
            ?? BudgetFormulas.Consumption(allocated: 0, available: budgetLine.amount, percentage: 0)
        return AddAllocatedTransactionLogic.realizationPrefill(
            for: budgetLine,
            consumption: consumption
        )
    }

    /// The currency the form types in — picker selection if the user changed
    /// it, falls back to the user's display currency on first render.
    private var effectiveCurrency: SupportedCurrency {
        inputCurrency ?? userSettingsStore.currency
    }

    private var inputCurrencyBinding: Binding<SupportedCurrency> {
        Binding(
            get: { effectiveCurrency },
            set: { inputCurrency = $0 }
        )
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let line = budgetLine {
                pageContent(for: line)
            } else {
                AutoPopView { budgetLine == nil }
            }
        }
    }

    @ViewBuilder
    private func pageContent(for line: BudgetLine) -> some View {
        ScrollView {
            formContent(for: line)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .pulpeBackground()
        .pulpeStickyBottomCTA { addButton(for: line) }
        .navigationTitle(line.name)
        .navigationBarTitleDisplayMode(.inline)
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
        .keyboardFieldNavigation(focus: $focusedField, order: [.amount, .description])
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .afterPushTransition {
            // Autofocus once. `didAutofocus` guards against re-entering this
            // task after a programmatic re-push that would otherwise steal
            // focus away from the description field.
            guard !didAutofocus else { return }
            didAutofocus = true
            focusedField = .amount
        }
        .task { await prefillRealization() }
        .onDisappear {
            focusedField = nil
        }
    }

    /// Copies the forecast into the form ONCE. Re-running it after a refused
    /// submit would overwrite what the user just corrected — which is exactly
    /// the value the refusal is about.
    private func prefillRealization() async {
        guard let realization, !didPrefill else { return }
        didPrefill = true
        name = realization.name
        if let remaining = realization.remainingAmount {
            amount = remaining
            amountText = "\(remaining)"
        }
        await refreshConfirmedBalance()
    }

    /// The goal balance shown next to the entry. Re-read after a refusal too:
    /// the figure the user was typing against is provably stale by then.
    private func refreshConfirmedBalance() async {
        guard case .active(let goalId, _)? = realization?.goalSource else { return }
        confirmedBalance = try? await savingsGoalStore.getProgress(id: goalId).confirmed
    }

    @ViewBuilder
    private func formContent(for line: BudgetLine) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            realizationHeader

            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: inputCurrencyBinding)
            }

            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: effectiveCurrency,
                accentColor: line.kind.color
            )

            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                amountField: .amount,
                color: line.kind.color,
                currency: effectiveCurrency
            )

            descriptionField(line: line)

            TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency)

            CheckedToggle(isOn: $isChecked, tintColor: line.kind.color)
            TagPickerField(selection: $selectedTagIds)

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.lg)
    }

    /// The goal being drawn from, and what it holds today — read-only. The source
    /// is not chosen here: the server inherits it from the forecast, and offering
    /// a picker would suggest it could be changed.
    @ViewBuilder
    private var realizationHeader: some View {
        if let realization {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SavingsGoalSourceLabel(source: realization.goalSource)

                if let confirmedBalance {
                    Text("Solde actuel · \(confirmedBalance.asAdaptiveCurrency(userSettingsStore.currency))")
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .sensitiveAmount()
                }
                if let remaining = realization.remainingAmount {
                    Text("Montant restant prévu · \(remaining.asAdaptiveCurrency(userSettingsStore.currency))")
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .sensitiveAmount()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func descriptionField(line: BudgetLine) -> some View {
        FormTextField(
            hint: line.kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            focusBinding: $focusedField,
            field: .description
        )
    }

    @ViewBuilder
    private func addButton(for line: BudgetLine) -> some View {
        let canSubmit = AddAllocatedTransactionLogic.isFormValid(
            name: name,
            amount: amount,
            isLoading: isLoading
        )
        let started = AddAllocatedTransactionLogic.hasStartedFilling(name: name, amount: amount)
        let hint = AddAllocatedTransactionLogic.validationHint(
            canSubmit: canSubmit,
            isLoading: isLoading,
            hasStartedFilling: started,
            amount: amount,
            name: name
        )

        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                Task { await add(for: line) }
            } label: {
                Text(realization == nil ? "Ajouter" : "Confirmer le retrait")
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

            if let hint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(DesignTokens.Animation.smoothEaseInOut, value: hint)
    }

    // MARK: - Logic

    private func add(for line: BudgetLine) async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: effectiveCurrency,
                to: userSettingsStore.currency
            )

            let data = AddAllocatedTransactionLogic.buildCreate(
                for: line,
                input: AddAllocatedTransactionLogic.FormInput(
                    name: name.trimmingCharacters(in: .whitespaces),
                    amount: amount,
                    transactionDate: transactionDate,
                    isChecked: isChecked,
                    conversion: conversion,
                    tagIds: TagPickerField.createdTagIds(from: selectedTagIds)
                )
            )

            // Routes the server call through the coordinator (Rule 9 — no
            // direct `TransactionService.shared.*` from view files). The
            // coordinator applies the optimistic local insert synchronously
            // once the server confirms, so the UI can dismiss immediately.
            _ = try await coordinator.createAllocatedTransaction(data)
            submitSuccessTrigger.toggle()
            toastManager.show("Enregistré")
            dismiss()
        } catch {
            // The entry stays on screen with everything the user typed: a refusal
            // (solde insuffisant, conflit) is about the amount, so throwing it
            // away would ask them to type the very thing being discussed again.
            // The balance it was judged against is stale by now — re-read it.
            self.error = error
            await refreshConfirmedBalance()
        }
    }
}
