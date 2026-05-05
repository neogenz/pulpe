import SwiftUI

/// Sheet for editing an existing template line — hero amount layout
struct EditTemplateLineSheet: View {
    let templateLine: TemplateLine
    let onUpdate: (TemplateLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var recurrence: TransactionRecurrence
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State private var showPropagationAlert = false
    @State private var usageData: TemplateUsageData?
    @State private var usageFetchFailed = false
    @State private var pendingUpdate: TemplateLineUpdate?
    private let inputCurrency: SupportedCurrency
    private let isAlternateCurrency: Bool

    private let dependencies: EditTemplateLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        templateLine: TemplateLine,
        userCurrency: SupportedCurrency,
        dependencies: EditTemplateLineDependencies = .live,
        onUpdate: @escaping (TemplateLine) -> Void
    ) {
        self.templateLine = templateLine
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _kind = State(initialValue: templateLine.kind)
        _recurrence = State(initialValue: templateLine.recurrence)

        let editableAmount = Self.initialAmount(for: templateLine, userCurrency: userCurrency)
        _amount = State(initialValue: editableAmount)
        let amountString = Formatters.amountInput.string(from: editableAmount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)

        self.inputCurrency = templateLine.originalCurrency ?? userCurrency
        self.isAlternateCurrency = Self.shouldShowAlternateCurrency(for: templateLine, userCurrency: userCurrency)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: "Modifier la ligne",
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
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
                originalAmount: templateLine.originalAmount,
                originalCurrency: templateLine.originalCurrency,
                exchangeRate: templateLine.exchangeRate
            )
            descriptionField
            recurrenceSelector

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task {
            do {
                usageData = try await dependencies.checkTemplateUsage(templateLine.templateId)
            } catch {
                usageFetchFailed = true
            }
        }
        .alert("Appliquer aux mois suivants ?", isPresented: $showPropagationAlert) {
            Button("Appliquer") {
                Task { await saveAndPropagateToBudgets() }
            }
            Button("Modèle uniquement") {
                Task { await saveTemplateOnly() }
            }
            Button("Annuler", role: .cancel) {
                pendingUpdate = nil
            }
        } message: {
            let count = usageData?.propagationBudgetCount ?? 0
            let intro = usageFetchFailed
                ? "Ce modèle est peut-être utilisé par d'autres budgets."
                : "Ce modèle est utilisé par \(count) \(count == 1 ? "budget" : "budgets")."
            Text("""
                \(intro)\n\n\
                « Appliquer » mettra à jour les budgets en cours et futurs. \
                Les catégories modifiées manuellement ne seront pas affectées.
                """)
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Nom de la ligne du modèle",
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Recurrence Selector

    private var recurrenceSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Récurrence")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            Picker("Récurrence", selection: $recurrence) {
                ForEach(TransactionRecurrence.allCases, id: \.self) { type in
                    Text(type.label).tag(type)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await updateTemplateLine() }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func updateTemplateLine() async {
        guard let amount else { return }

        error = nil

        do {
            let conversion: CurrencyConversion? = if isAlternateCurrency {
                try await conversionService.convert(
                    amount: amount,
                    from: inputCurrency,
                    to: userSettingsStore.currency
                )
            } else {
                nil
            }

            pendingUpdate = Self.buildUpdate(
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                recurrence: recurrence,
                conversion: conversion
            )

            let hasBudgets = usageFetchFailed || (usageData?.propagationBudgetCount ?? 0) > 0
            if hasBudgets {
                showPropagationAlert = true
            } else {
                await saveTemplateOnly()
            }
        } catch {
            self.error = error
        }
    }

    private func saveTemplateOnly() async {
        guard let data = pendingUpdate else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let updatedLine = try await dependencies.updateTemplateLine(templateLine.templateId, templateLine.id, data)
            finishSave(updatedLine: updatedLine, message: "Prévision modifiée")
        } catch {
            self.error = error
        }
    }

    private func saveAndPropagateToBudgets() async {
        guard let data = pendingUpdate else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let operations = TemplateLinesBulkOperations(
                update: [TemplateLineUpdateWithId(
                    id: templateLine.id,
                    name: data.name,
                    amount: data.amount,
                    kind: data.kind,
                    recurrence: data.recurrence,
                    description: data.description,
                    originalAmount: data.originalAmount,
                    originalCurrency: data.originalCurrency,
                    targetCurrency: data.targetCurrency,
                    exchangeRate: data.exchangeRate
                )],
                propagateToBudgets: true
            )
            let response = try await dependencies.bulkUpdateWithPropagation(templateLine.templateId, operations)
            let updatedLine = response.updated.first ?? templateLine
            let affectedCount = response.propagation?.affectedBudgetsCount ?? 0
            let message = affectedCount > 0
                ? "Prévision modifiée — \(affectedCount) "
                + (affectedCount == 1 ? "budget mis à jour" : "budgets mis à jour")
                : "Prévision modifiée"
            finishSave(updatedLine: updatedLine, message: message)
        } catch {
            self.error = error
        }
    }

    private func finishSave(updatedLine: TemplateLine, message: String) {
        submitSuccessTrigger.toggle()
        onUpdate(updatedLine)
        toastManager.show(message)
        pendingUpdate = nil
        dismiss()
    }

    // MARK: - Pure Helpers (testable)

    static func shouldShowAlternateCurrency(
        for line: TemplateLine,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let lineCurrency = line.originalCurrency else { return false }
        return lineCurrency != userCurrency
    }

    static func initialAmount(for line: TemplateLine, userCurrency: SupportedCurrency) -> Decimal {
        if shouldShowAlternateCurrency(for: line, userCurrency: userCurrency),
           let originalAmount = line.originalAmount {
            return originalAmount
        }
        return line.amount
    }

    static func buildUpdate(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        conversion: CurrencyConversion?
    ) -> TemplateLineUpdate {
        guard let conversion else {
            return TemplateLineUpdate(
                name: name,
                amount: amount,
                kind: kind,
                recurrence: recurrence
            )
        }
        return TemplateLineUpdate(
            name: name,
            amount: conversion.convertedAmount,
            kind: kind,
            recurrence: recurrence,
            originalAmount: conversion.originalAmount,
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate
        )
    }
}

struct EditTemplateLineDependencies: Sendable {
    var updateTemplateLine: @Sendable (String, String, TemplateLineUpdate) async throws -> TemplateLine
    var checkTemplateUsage: @Sendable (String) async throws -> TemplateUsageData
    var bulkUpdateWithPropagation: @Sendable (
        String, TemplateLinesBulkOperations
    ) async throws -> TemplateLinesBulkOperationsResponse

    static let live = EditTemplateLineDependencies(
        updateTemplateLine: { templateId, lineId, data in
            try await TemplateService.shared.updateTemplateLine(templateId: templateId, lineId: lineId, data: data)
        },
        checkTemplateUsage: { templateId in
            try await TemplateService.shared.checkTemplateUsage(id: templateId)
        },
        bulkUpdateWithPropagation: { templateId, operations in
            try await TemplateService.shared.bulkUpdateTemplateLines(templateId: templateId, operations: operations)
        }
    )
}

#Preview {
    EditTemplateLineSheet(
        templateLine: TemplateLine(
            id: "test",
            templateId: "template-1",
            name: "Test Template Line",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            description: "",
            createdAt: Date(),
            updatedAt: Date()
        ),
        userCurrency: .chf
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
