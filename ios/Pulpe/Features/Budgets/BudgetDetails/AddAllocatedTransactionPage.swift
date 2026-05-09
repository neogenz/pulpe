import SwiftUI

/// Push page for adding a new transaction allocated to a specific budget line.
///
/// Replaces the legacy `AddAllocatedTransactionSheet`. Resolves the parent
/// `BudgetLine` reactively from `BudgetDetailsViewModel` (injected via
/// `.environment(viewModel)` on the navigation destination); when the line is
/// removed externally the page auto-pops.
struct AddAllocatedTransactionPage: View {
    let lineId: String

    @Environment(BudgetDetailsViewModel.self) private var viewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore

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
    @FocusState private var focusedField: AmountDescriptionField?

    private let conversionService = CurrencyConversionService.shared

    // MARK: - Derived

    private var budgetLine: BudgetLine? {
        viewModel.budgetLines.first { $0.id == lineId }
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
                Color.clear.task { await autoPopIfStillEmpty() }
            }
        }
    }

    private func autoPopIfStillEmpty() async {
        try? await Task.sleep(for: .milliseconds(150))
        guard !Task.isCancelled else { return }
        if budgetLine == nil { dismiss() }
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
        .hidesFloatingTabBar()
        .navigationTitle(line.name)
        .navigationBarTitleDisplayMode(.inline)
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
        .keyboardFieldNavigation(focus: $focusedField, order: [.amount, .description])
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task {
            // Autofocus once. `didAutofocus` guards against re-entering this
            // task after a programmatic re-push that would otherwise steal
            // focus away from the description field.
            guard !didAutofocus else { return }
            didAutofocus = true
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            focusedField = .amount
        }
    }

    @ViewBuilder
    private func formContent(for line: BudgetLine) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            if userSettingsStore.showCurrencySelectorEffective {
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

            TransactionDateSelector(date: $transactionDate)

            CheckedToggle(isOn: $isChecked, tintColor: line.kind.color)

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.lg)
    }

    private func descriptionField(line: BudgetLine) -> some View {
        FormTextField(
            hint: line.kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la transaction",
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
                Text("Ajouter")
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
                    conversion: conversion
                )
            )

            let transaction = try await TransactionService.shared.createTransaction(data)

            // Apply local update + emit feedback + pop. `addTransaction` is
            // a synchronous local insert on the viewModel — no detached Task
            // needed here.
            viewModel.addTransaction(transaction)
            submitSuccessTrigger.toggle()
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}
