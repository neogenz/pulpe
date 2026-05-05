import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
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

    private let dependencies: AddBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetId: String,
        dependencies: AddBudgetLineDependencies = .live,
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.budgetId = budgetId
        self.dependencies = dependencies
        self.onAdd = onAdd
    }

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
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
            descriptionField
            CheckedToggle(isOn: $isChecked, tintColor: kind.color)

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { inputCurrency = userSettingsStore.currency }
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

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await addBudgetLine() } } label: {
                Text("Ajouter")
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
}

struct AddBudgetLineDependencies: Sendable {
    var createBudgetLine: @Sendable (BudgetLineCreate) async throws -> BudgetLine

    static let live = AddBudgetLineDependencies(
        createBudgetLine: { data in
            try await BudgetLineService.shared.createBudgetLine(data)
        }
    )
}

#Preview {
    AddBudgetLineSheet(budgetId: "test") { line in
        print("Added: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
}
