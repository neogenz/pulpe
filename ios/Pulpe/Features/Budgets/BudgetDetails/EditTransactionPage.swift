import SwiftUI

/// Push page for editing an existing transaction.
///
/// Replaces the legacy `EditTransactionSheet`. Resolves its model reactively
/// from the shared `BudgetDetailsViewModel` (injected via
/// `.environment(viewModel)` on the navigation destination), so concurrent
/// mutations (sync, FX rate refresh) flow back into the form via Observation.
///
/// When the underlying transaction is removed (delete commit, filter sync) the
/// page auto-pops via `dismiss()` from the empty branch.
struct EditTransactionPage: View {
    let transactionId: String

    @Environment(BudgetDetailsCoordinator.self) private var coordinator
    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore

    @State private var name = ""
    @State private var amount: Decimal?
    @State private var amountText = ""
    @State private var kind: TransactionKind = .expense
    @State private var transactionDate: Date = .now
    @State private var error: Error?
    @State private var isLoading = false
    @State private var submitSuccessTrigger = false
    @State private var didAutofocus = false
    @FocusState private var focusedField: AmountDescriptionField?

    private let conversionService = CurrencyConversionService.shared

    // MARK: - Derived

    private var transaction: Transaction? {
        coordinator.dataStore.transactions.first { $0.id == transactionId }
    }

    /// Currency the user types in (matches the original capture currency for FX
    /// transactions, or the user's display currency for mono-currency edits).
    private var inputCurrency: SupportedCurrency {
        transaction?.originalCurrency ?? userSettingsStore.currency
    }

    private var isAlternateCurrency: Bool {
        guard let tx = transaction else { return false }
        return EditTransactionLogic.shouldShowAlternateCurrency(
            for: tx,
            userCurrency: userSettingsStore.currency
        )
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let tx = transaction {
                pageContent(for: tx)
            } else {
                // Transaction removed externally → auto-pop after a short
                // grace window. The grace gives Observation a chance to
                // settle on first push frame so a transient lookup miss
                // (rare during reload races) does not pop a fresh page.
                Color.clear.task { await autoPopIfStillEmpty() }
            }
        }
    }

    private func autoPopIfStillEmpty() async {
        try? await Task.sleep(for: .milliseconds(150))
        guard !Task.isCancelled else { return }
        if transaction == nil { dismiss() }
    }

    @ViewBuilder
    private func pageContent(for tx: Transaction) -> some View {
        ScrollView {
            formContent(for: tx)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .pulpeBackground()
        .pulpeStickyBottomCTA { saveButton(for: tx) }
        .hidesFloatingTabBar()
        .navigationTitle("Modifier la transaction")
        .navigationBarTitleDisplayMode(.inline)
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
        .keyboardFieldNavigation(focus: $focusedField, order: [.amount, .description])
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task(id: tx.id) { hydrate(from: tx) }
        .task {
            // Autofocus once. `didAutofocus` guards against re-entering this
            // task after a programmatic re-push (deep link, back-then-forward)
            // that would otherwise steal focus away from the description field
            // if the user has already typed there.
            guard !didAutofocus else { return }
            didAutofocus = true
            // Short delay so the push transition completes before the
            // keyboard rises (matches `SheetFormContainer` behavior).
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            focusedField = .amount
        }
    }

    @ViewBuilder
    private func formContent(for tx: Transaction) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            KindToggle(selection: $kind)

            if userSettingsStore.showCurrencySelectorEffective && isAlternateCurrency {
                CurrencyAmountPicker(
                    selectedCurrency: .constant(inputCurrency),
                    isReadOnly: true
                )
            }

            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: inputCurrency,
                accentColor: kind.color
            )

            CurrencyConversionBadge(
                originalAmount: tx.originalAmount,
                originalCurrency: tx.originalCurrency,
                exchangeRate: tx.exchangeRate
            )

            descriptionField

            TransactionDateSelector(date: $transactionDate)

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.top, DesignTokens.Spacing.lg)
    }

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la transaction",
            focusBinding: $focusedField,
            field: .description
        )
    }

    @ViewBuilder
    private func saveButton(for tx: Transaction) -> some View {
        let canSubmit = EditTransactionLogic.isFormValid(
            name: name,
            amount: amount,
            isLoading: isLoading
        )
        Button {
            Task { await save(for: tx) }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    /// Re-fires when `tx.id` changes (i.e. on first appearance, never again
    /// during this push lifecycle since the transaction id is stable).
    private func hydrate(from tx: Transaction) {
        name = tx.name
        kind = tx.kind
        transactionDate = tx.transactionDate

        let editable = EditTransactionLogic.initialAmount(
            for: tx,
            userCurrency: userSettingsStore.currency
        )
        amount = editable
        amountText = Formatters.amountInput.string(from: editable as NSDecimalNumber) ?? ""
    }

    private func save(for tx: Transaction) async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion: CurrencyConversion?
            if isAlternateCurrency {
                conversion = try await conversionService.convert(
                    amount: amount,
                    from: inputCurrency,
                    to: userSettingsStore.currency
                )
            } else {
                conversion = nil
            }

            let data = EditTransactionLogic.buildUpdate(
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                transactionDate: transactionDate,
                conversion: conversion
            )

            let updated = try await TransactionService.shared.updateTransaction(id: tx.id, data: data)

            // Fire haptic + toast + dismiss while the view is still alive so
            // SwiftUI can resolve the sensory feedback and animate the pop.
            // The viewModel reconciliation runs detached: the optimistic
            // local update is fast, the server reload converges asynchronously
            // without blocking the UI.
            submitSuccessTrigger.toggle()
            toastManager.show("Transaction modifiée")
            dismiss()
            Task { await coordinator.dispatch(.updateTransaction(updated)) }
        } catch {
            self.error = error
        }
    }
}
