import SwiftUI

enum EditTemplateLineSaveImpact: Equatable {
    case templateOnly
    case budgetsChanged

    static func propagation(affectedBudgetsCount: Int) -> Self {
        affectedBudgetsCount > 0 ? .budgetsChanged : .templateOnly
    }
}

/// Sheet for editing an existing template line (V2 `Modele-ligne`): the amount, its name, its
/// nature, « Quand ? », the tags and what it does to the model's disponible. When budgets were
/// built from the model, saving opens a second step (`Modele-propager`) inside the sheet.
struct EditTemplateLineSheet: View {
    enum Step { case edit, propagation }

    let templateLine: TemplateLine
    let templateName: String
    /// The model's lines, to judge what the edit does to its disponible.
    let templateLines: [TemplateLine]
    let onUpdate: (TemplateLine, EditTemplateLineSaveImpact) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) var toastManager
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(CurrentMonthStore.self) var currentMonthStore
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var recurrence: TransactionRecurrence
    @State private var savingsGoalId: String?
    @State private var assetId: String?
    @State private var selectedTagIds: Set<String>
    @State var isLoading = false
    @State var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State var step = Step.edit
    @State var propagationChoice = PropagationChoice.templateAndMonths
    @State private var usageData: TemplateUsageData?
    @State private var usageFetchFailed = false
    @State var pendingUpdate: TemplateLineUpdate?
    private let inputCurrency: SupportedCurrency
    private let isAlternateCurrency: Bool
    private let initialTagIds: Set<String>
    private let initialAmount: Decimal

    private let dependencies: EditTemplateLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        templateLine: TemplateLine,
        templateName: String = "",
        templateLines: [TemplateLine] = [],
        userCurrency: SupportedCurrency,
        dependencies: EditTemplateLineDependencies = .live,
        onUpdate: @escaping (TemplateLine, EditTemplateLineSaveImpact) -> Void
    ) {
        self.templateLine = templateLine
        self.templateName = templateName
        self.templateLines = templateLines
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _kind = State(initialValue: templateLine.kind)
        _recurrence = State(initialValue: templateLine.recurrence)
        _savingsGoalId = State(initialValue: templateLine.savingsGoalId)
        _assetId = State(initialValue: templateLine.assetId)
        let tagIds = Set(templateLine.tagIds ?? [])
        _selectedTagIds = State(initialValue: tagIds)
        initialTagIds = tagIds

        let inputCurrency = templateLine.originalCurrency ?? userCurrency
        let editableAmount = Self.initialAmount(for: templateLine, userCurrency: userCurrency)
        _amount = State(initialValue: editableAmount)
        initialAmount = editableAmount
        let amountString = Formatters.amountInput(for: inputCurrency)
            .string(from: editableAmount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)

        self.inputCurrency = inputCurrency
        self.isAlternateCurrency = Self.shouldShowAlternateCurrency(for: templateLine, userCurrency: userCurrency)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var propagationBudgetCount: Int {
        usageData?.propagationBudgetCount(payDayOfMonth: userSettingsStore.payDayOfMonth) ?? 0
    }

    var body: some View {
        switch step {
        case .edit: editForm
        case .propagation: propagationStep
        }
    }

    private var editForm: some View {
        SheetFormContainer(
            title: AppLocale.string("Modifier la ligne"),
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            if userSettingsStore.showCurrencySelector && isAlternateCurrency {
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
                caption: beforeCaption
            )
            CurrencyConversionBadge(
                originalAmount: templateLine.originalAmount,
                originalCurrency: templateLine.originalCurrency,
                exchangeRate: templateLine.exchangeRate
            )
            descriptionField
            KindToggle(selection: $kind)
            TemplateWhenSection(recurrence: $recurrence, templateName: templateName)
            FormCard {
                TagPickerField(selection: $selectedTagIds, style: .row)
            }
            if kind == .saving {
                FormCard {
                    SavingsGoalPickerField(selection: $savingsGoalId, style: .row)
                }
            }
            if AssetPickerField.isShown(kind: kind, flagEnabled: featureFlags.isNetWorthEnabled) {
                FormCard {
                    AssetPickerField(selection: $assetId, kind: kind)
                }
            }
            if let impact = availableImpact {
                ImpactBlock(
                    title: AppLocale.string("Disponible de départ du modèle"),
                    before: impact.before,
                    after: impact.after,
                    currency: userSettingsStore.currency
                )
                .sensitiveAmount()
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onChange(of: kind) { _, newKind in
            // Mirror the backend kind-guard: only savings can carry a goal.
            if newKind != .saving { savingsGoalId = nil }
            assetId = newKind == templateLine.kind ? templateLine.assetId : nil
        }
        .task {
            do {
                usageData = try await dependencies.checkTemplateUsage(templateLine.templateId)
            } catch {
                usageFetchFailed = true
            }
        }
    }

    /// « avant 150.00 », once the amount moves.
    private var beforeCaption: String? {
        guard let amount, amount != initialAmount else { return nil }
        return AppLocale.string("avant \(initialAmount.asAmount(for: inputCurrency))")
    }

    /// What the edit does to the model's disponible. ponytail: a line typed in another currency
    /// skips it; judging it would need a conversion per keystroke.
    private var availableImpact: (before: Decimal, after: Decimal)? {
        guard !isAlternateCurrency, let amount, amount > 0 else { return nil }
        return TemplatePresentation.availableImpact(
            lines: templateLines, lineId: templateLine.id, amount: amount, kind: kind
        )
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            accessibilityLabel: AppLocale.string("Nom de la ligne du modèle"),
            focusBinding: $focusedField,
            field: .description,
            onSubmit: {
                guard canSubmit else { return }
                Task { await updateTemplateLine() }
            }
        )
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

            var update = Self.buildUpdate(
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                recurrence: recurrence,
                conversion: conversion,
                tagIds: TagPickerField.updatedTagIds(initial: initialTagIds, current: selectedTagIds)
            )
            // Always emit the link (id or explicit null) so a saving line can be
            // tagged or untagged; the kind-guard clears it for non-saving kinds.
            update.savingsGoalId = .some(kind.savingsGoalLink(savingsGoalId))
            // Unlike the goal link, only emitted when it moved: an untouched edit must not clear it.
            update.assetId = Self.assetChange(line: templateLine, kind: kind, assetId: assetId)
            pendingUpdate = update

            let hasBudgets = usageFetchFailed || propagationBudgetCount > 0
            if hasBudgets {
                withAnimation(DesignTokens.Animation.smoothEaseOut) { step = .propagation }
            } else {
                await saveTemplateOnly()
            }
        } catch {
            self.error = error
        }
    }

    func saveTemplateOnly() async {
        guard let data = pendingUpdate else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let updatedLine = try await dependencies.updateTemplateLine(templateLine.templateId, templateLine.id, data)
            finishSave(
                updatedLine: updatedLine,
                message: AppLocale.string("Prévision modifiée"),
                impact: .templateOnly
            )
        } catch {
            self.error = error
        }
    }

    func saveAndPropagateToBudgets() async {
        guard let data = pendingUpdate else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let operations = TemplateLinesBulkOperations(
                update: [Self.propagationUpdate(id: templateLine.id, data: data)],
                propagateToBudgets: true
            )
            let response = try await dependencies.bulkUpdateWithPropagation(templateLine.templateId, operations)
            let updatedLine = response.updated.first ?? templateLine
            let affectedCount = response.propagation?.affectedBudgetsCount ?? 0
            let message = affectedCount > 0
                ? AppLocale.string("Prévision modifiée — \(affectedCount) budgets mis à jour")
                : AppLocale.string("Prévision modifiée")
            finishSave(
                updatedLine: updatedLine,
                message: message,
                impact: EditTemplateLineSaveImpact.propagation(affectedBudgetsCount: affectedCount)
            )
        } catch {
            self.error = error
        }
    }

    private func finishSave(
        updatedLine: TemplateLine,
        message: String,
        impact: EditTemplateLineSaveImpact
    ) {
        submitSuccessTrigger.toggle()
        onUpdate(updatedLine, impact)
        toastManager.show(message)
        pendingUpdate = nil
        dismiss()
    }
}

extension EditTemplateLineSheet {
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

    static func assetChange(line: TemplateLine, kind: TransactionKind, assetId: String?) -> String?? {
        lineAssetChange(initialKind: line.kind, kind: kind, initialAssetId: line.assetId, assetId: assetId)
    }

    static func buildUpdate(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        conversion: CurrencyConversion?,
        tagIds: [String]? = nil
    ) -> TemplateLineUpdate {
        guard let conversion else {
            return TemplateLineUpdate(
                name: name,
                amount: amount,
                kind: kind,
                recurrence: recurrence,
                tagIds: tagIds
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
            exchangeRate: conversion.exchangeRate,
            tagIds: tagIds
        )
    }

    static func propagationUpdate(id: String, data: TemplateLineUpdate) -> TemplateLineUpdateWithId {
        TemplateLineUpdateWithId(
            id: id,
            name: data.name,
            amount: data.amount,
            kind: data.kind,
            recurrence: data.recurrence,
            description: data.description,
            savingsGoalId: data.savingsGoalId,
            assetId: data.assetId,
            originalAmount: data.originalAmount,
            originalCurrency: data.originalCurrency,
            targetCurrency: data.targetCurrency,
            exchangeRate: data.exchangeRate,
            tagIds: data.tagIds
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
    ) { line, _ in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(SavingsGoalStore())
    .environment(AssetStore())
    .environment(FeatureFlagsStore())
    .environment(TagStore())
}
