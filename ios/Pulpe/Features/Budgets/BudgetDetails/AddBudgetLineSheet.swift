import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var isChecked = false
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false
    @State private var inputCurrency: SupportedCurrency = .chf
    @State private var mode: BudgetLineCreationMode = .once
    @State private var amountMode: SpreadAmountMode = .total
    @State private var spreadCalculator: SpreadCalculator
    /// Idempotency key for the spread create (PUL-17), minted ONCE per sheet
    /// presentation (= per create intent) and reused on every submit retry so a
    /// double-tap or a retry after a post-commit failure replays the same group
    /// instead of duplicating it. `.sheet(item:)` rebuilds this view per
    /// presentation, so a fresh intent always gets a fresh key. Lowercased to
    /// mirror the web's `crypto.randomUUID()`.
    @State private var spreadGroupId = UUID().uuidString.lowercased()

    private let dependencies: AddBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetId: String,
        anchorMonth: Int,
        anchorYear: Int,
        dependencies: AddBudgetLineDependencies = .live,
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.budgetId = budgetId
        self.dependencies = dependencies
        self.onAdd = onAdd
        // Anchor the spread on the OPENED budget's period — not the device's
        // current month — so tranches land in the right months (PUL-17).
        self._spreadCalculator = State(initialValue: SpreadCalculator(
            anchorMonth: anchorMonth,
            anchorYear: anchorYear
        ))
    }

    private var isSpreadMode: Bool { mode == .spread }

    /// Hero hint follows the amount mode in spread mode — "Montant total" when the
    /// server divides, "Montant par mois" when it replicates. `nil` outside spread.
    private var amountFieldHint: String? {
        guard isSpreadMode else { return nil }
        return amountMode == .total ? "Montant total" : "Montant par mois"
    }

    private var canSubmit: Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty,
              (amount ?? 0) > 0,
              !isLoading else { return false }
        return isSpreadMode ? spreadCalculator.isValid : true
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
        return nil
    }

    var body: some View {
        SheetFormContainer(
            title: kind.newBudgetLineTitle,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            KindToggle(selection: $kind)
            if userSettingsStore.showCurrencySelectorEffective {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: amountFieldHint,
                currency: inputCurrency,
                accentColor: kind.color
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                amountField: .amount,
                color: kind.color,
                currency: inputCurrency
            )
            .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)

            // Spread toggle hidden for income — revenu lissé is out of scope (PUL-17).
            if kind != .income {
                SpreadModeToggle(selection: $mode, accentColor: kind.color)
            }

            descriptionField

            if isSpreadMode {
                SpreadAmountModeToggle(mode: $amountMode, accentColor: kind.color)
                SpreadFormSection(
                    calculator: spreadCalculator,
                    amount: amount,
                    amountMode: amountMode,
                    currency: inputCurrency,
                    accentColor: kind.color
                )
            } else if userSettingsStore.checkingEnabled {
                CheckedToggle(isOn: $isChecked, tintColor: kind.color)
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { inputCurrency = userSettingsStore.currency }
        // Income can't be spread: bouncing back to income resets the mode.
        .onChange(of: kind) { _, newKind in
            if newKind == .income { mode = .once }
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la prévision",
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Add Button

    private var ctaTitle: String {
        isSpreadMode ? "Lisser la dépense" : "Ajouter"
    }

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await submit() } } label: {
                Text(ctaTitle)
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

            if let hint = validationHint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: validationHint)
    }

    // MARK: - Logic

    /// Routes to the single-line or spread flow. The "Une seule fois" path is
    /// unchanged; "Lisser" fans the amount out over the selected months.
    private func submit() async {
        if isSpreadMode {
            await addSpread()
        } else {
            await addBudgetLine()
        }
    }

    private func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )

            let data = BudgetLineCreate(
                budgetId: budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                recurrence: .oneOff,
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )

            let budgetLine = try await dependencies.createBudgetLine(data)
            submitSuccessTrigger.toggle()
            onAdd(budgetLine)
            toastManager.show("Prévision ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }

    /// Fans the per-month amount over every SELECTED month (PUL-17, interpretation B).
    /// FX is frozen once: a single conversion feeds one `exchangeRate` shared by
    /// every tranche, and each tranche carries the same `originalAmount` when
    /// multi-currency. On success the cross-budget caches are invalidated OUTSIDE
    /// any coordinator (a spread touches N months that the detail coordinator
    /// doesn't own) so the list and every detail page revalidate. The single
    /// occurrence landing in the CURRENTLY-open budget is fed back through
    /// `onAdd` so the active detail screen refreshes immediately (same seam as
    /// the single-line path) — the `.task(id:)` doesn't re-run on sheet dismiss.
    private func addSpread() async {
        guard let amount, spreadCalculator.isValid else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let data = AddBudgetLineSpreadLogic.buildCreate(
                calculator: spreadCalculator,
                input: AddBudgetLineSpreadLogic.SubmitInput(
                    name: name,
                    kind: kind,
                    amount: amount,
                    mode: amountMode,
                    conversion: conversion,
                    spreadGroupId: spreadGroupId
                )
            )

            let response = try await dependencies.createSpread(data)

            // Refresh the active detail screen when one occurrence landed in the
            // currently-open budget — reuses the single-line `onAdd` seam so the
            // coordinator appends the line + recomputes totals (PUL-270).
            if let openLine = response.lines.first(where: { $0.budgetId == budgetId }) {
                onAdd(openLine)
            }

            // Cross-budget invalidation — OUTSIDE the coordinator (spec PUL-17).
            // Still required for the OTHER months the coordinator doesn't own.
            dependencies.invalidateCrossBudgetCaches(budgetListStore)

            submitSuccessTrigger.toggle()
            toastManager.show(AddBudgetLineSpreadLogic.successMessage(for: response))
            dismiss()
        } catch {
            self.error = error
        }
    }
}

struct AddBudgetLineDependencies: Sendable {
    var createBudgetLine: @Sendable (BudgetLineCreate) async throws -> BudgetLine
    var createSpread: @Sendable (BudgetLineSpreadCreate) async throws -> BudgetLineSpreadResponse
    /// Cross-budget cache invalidation fired on spread success — OUTSIDE the
    /// BudgetDetails coordinator. Injectable so tests can assert it ran.
    var invalidateCrossBudgetCaches: @MainActor (BudgetListStore) -> Void

    static let live = AddBudgetLineDependencies(
        createBudgetLine: { data in
            try await BudgetLineService.shared.createBudgetLine(data)
        },
        createSpread: { data in
            try await BudgetLineService.shared.createSpread(data)
        },
        invalidateCrossBudgetCaches: { budgetListStore in
            BudgetDetailCache.shared.invalidateAll()
            budgetListStore.invalidateCache()
        }
    )
}

#Preview {
    AddBudgetLineSheet(budgetId: "test", anchorMonth: 6, anchorYear: 2026) { line in
        print("Added: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(BudgetListStore())
}
