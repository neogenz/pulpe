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
    @Environment(BudgetDetailsProjector.self) private var projector
    @Environment(BudgetDetailsRouter.self) private var router
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
    @State private var showDeleteConfirmation = false
    @State private var pendingPostpone: PostponeTarget?
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

    /// The spread group of this transaction's parent budget line, if it belongs
    /// to a "Lisser" expense — drives the occurrences affordance (PUL-17). A
    /// transaction never carries `spreadGroupId` itself; its lissé-ness derives
    /// from its parent line, resolved via the projector's O(1) `lineById` index.
    private func parentSpreadGroupId(for tx: Transaction) -> UUID? {
        guard let lineId = tx.budgetLineId else { return nil }
        return projector.screenState.lineById[lineId]?.spreadGroupId
    }

    /// A FREE transaction (no parent line) that isn't income can be redistributed
    /// into a total-preserving spread (PUL-17 v1.1). An allocated transaction
    /// derives its lissé-ness from its parent line — it shows the occurrences
    /// affordance instead, never this action.
    private func canSpread(_ tx: Transaction) -> Bool {
        tx.budgetLineId == nil && tx.kind != .income
    }

    private func presentSpread(for tx: Transaction) {
        guard let budget = coordinator.dataStore.budget else { return }
        router.present(.spreadExisting(SpreadExistingSource(
            id: tx.id,
            sourceType: .transaction,
            kind: tx.kind,
            name: tx.name,
            total: tx.amount,
            month: budget.month,
            year: budget.year
        )))
    }

    // MARK: - Body

    var body: some View {
        Group {
            if let tx = transaction {
                pageContent(for: tx)
            } else {
                AutoPopView { transaction == nil }
            }
        }
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
        .navigationTitle("Modifier la transaction")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                headerMenu(for: tx)
            }
        }
        .alert(
            "Supprimer la transaction ?",
            isPresented: $showDeleteConfirmation,
            presenting: tx
        ) { tx in
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                deleteTransaction(tx)
            }
        } message: { _ in
            Text("Tu auras quelques secondes pour annuler.")
        }
        .postponeConfirmation(
            target: $pendingPostpone,
            nextMonthLabel: projector.screenState.nextMonthLabel
        ) { target in
            postpone(target)
        }
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
        .keyboardFieldNavigation(focus: $focusedField, order: [.amount, .description])
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task(id: tx.id) { hydrate(from: tx) }
        .afterPushTransition {
            // Autofocus once. `didAutofocus` guards against re-entering this
            // task after a programmatic re-push (deep link, back-then-forward)
            // that would otherwise steal focus away from the description field
            // if the user has already typed there.
            guard !didAutofocus else { return }
            didAutofocus = true
            focusedField = .amount
        }
        .onDisappear {
            focusedField = nil
        }
    }

    @ViewBuilder
    private func formContent(for tx: Transaction) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            if let spreadGroupId = parentSpreadGroupId(for: tx) {
                SpreadAffordanceButton {
                    router.present(.spreadOccurrences(spreadGroupId: spreadGroupId.uuidString))
                }
            }

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

            TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency)

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

    @ViewBuilder
    private func headerMenu(for tx: Transaction) -> some View {
        Menu {
            if canSpread(tx) {
                Button {
                    presentSpread(for: tx)
                } label: {
                    Label("Lisser sur plusieurs mois", systemImage: "calendar")
                }
            }
            PostponeMenuButton(
                isEligible: tx.budgetLineId == nil && tx.checkedAt == nil,
                canPostpone: projector.screenState.canPostpone,
                nextMonthLabel: projector.screenState.nextMonthLabel,
                onPostpone: { pendingPostpone = .transaction(tx) }
            )
            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                Label("Supprimer", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Plus d'options")
    }

    // MARK: - Logic

    /// Soft-deletes via the coordinator (same undo-toast machinery as budget
    /// lines). We do NOT call `dismiss()`: removing the transaction empties
    /// `transaction`, the `AutoPopView` branch fires, and the page pops once —
    /// calling `dismiss()` here too would race that and risk a double-pop.
    private func deleteTransaction(_ tx: Transaction) {
        let ctx = ToastContext(
            toastManager: toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.dispatch(.softDeleteTransaction(tx, ctx)) }
    }

    /// Reports the transaction to next month. Optimistic remove → the page
    /// auto-pops; the coordinator shows an error toast on failure (PUL-22).
    private func postpone(_ target: PostponeTarget) {
        guard case .transaction(let tx) = target else { return }
        let ctx = ToastContext(
            toastManager: toastManager,
            presentationCurrency: userSettingsStore.currency
        )
        Task { await coordinator.postponeTransaction(tx, context: ctx) }
    }

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
        amountText = Formatters.amountInput(for: inputCurrency).string(from: editable as NSDecimalNumber) ?? ""
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

            // Routes the server call through the coordinator (Rule 9 — no
            // direct `TransactionService.shared.*` from view files). Local
            // apply is synchronous on return; background reload converges the
            // rest of the budget without blocking dismiss.
            _ = try await coordinator.updateTransaction(id: tx.id, data: data)

            submitSuccessTrigger.toggle()
            toastManager.show("Transaction modifiée")
            dismiss()
            Task { await coordinator.dispatch(.reloadCurrentBudget) }
        } catch {
            self.error = error
        }
    }
}
