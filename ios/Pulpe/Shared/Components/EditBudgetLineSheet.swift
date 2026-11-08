import SwiftUI

/// Sheet for editing an existing budget line (prévision) — hero amount layout
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine
    /// Period of the budget holding the line — bounds its savings-goal links.
    let budgetPeriod: BudgetPeriod?
    /// The month as it stands, to show what the new amount does to the disponible.
    let ledger: MonthLedger?
    /// Template of the budget, to name the amount the model keeps for this prévision.
    let templateId: String?
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var savingsGoalId: String?
    @State private var assetId: String?
    @State private var selectedTagIds: Set<String>
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State private var templateAmount: Decimal?
    private let inputCurrency: SupportedCurrency
    private let isAlternateCurrency: Bool
    private let initialTagIds: Set<String>
    /// The amount when the sheet opened, in the input currency: the « avant » figure.
    private let initialAmount: Decimal

    private let dependencies: EditBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetLine: BudgetLine,
        userCurrency: SupportedCurrency,
        budgetPeriod: BudgetPeriod? = nil,
        ledger: MonthLedger? = nil,
        templateId: String? = nil,
        dependencies: EditBudgetLineDependencies = .live,
        onUpdate: @escaping (BudgetLine) -> Void
    ) {
        self.budgetLine = budgetLine
        self.budgetPeriod = budgetPeriod
        self.ledger = ledger
        self.templateId = templateId
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _kind = State(initialValue: budgetLine.kind)
        _savingsGoalId = State(initialValue: budgetLine.savingsGoalId)
        _assetId = State(initialValue: budgetLine.assetId)
        let tagIds = Set(budgetLine.tagIds ?? [])
        _selectedTagIds = State(initialValue: tagIds)
        initialTagIds = tagIds

        let inputCurrency = budgetLine.originalCurrency ?? userCurrency
        let editableAmount = Self.initialAmount(for: budgetLine, userCurrency: userCurrency)
        _amount = State(initialValue: editableAmount)
        initialAmount = editableAmount
        let amountString = Formatters.amountInput(for: inputCurrency)
            .string(from: editableAmount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)

        self.inputCurrency = inputCurrency
        self.isAlternateCurrency = Self.shouldShowAlternateCurrency(for: budgetLine, userCurrency: userCurrency)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: kind.editBudgetLineTitle,
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
                caption: plannedCaption
            )
            CurrencyConversionBadge(
                originalAmount: budgetLine.originalAmount,
                originalCurrency: budgetLine.originalCurrency,
                exchangeRate: budgetLine.exchangeRate
            )
            // The amount above, then its name, its nature, and the details.
            FormCard { descriptionField }
            KindToggle(selection: $kind)
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                FormCard {
                    TagPickerField(selection: $selectedTagIds, style: .row)
                    FormRowDivider()
                    frequencyRow
                }
                if let scopeNote {
                    Text(scopeNote)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .padding(.horizontal, DesignTokens.Spacing.xs)
                        .sensitiveAmount()
                }
            }
            if let impact = availableImpact, let month = budgetPeriod?.month {
                ImpactBlock(
                    title: ReportWording.availableTitle(of: month),
                    before: impact.figures.before,
                    after: impact.figures.after,
                    currency: userSettingsStore.currency,
                    note: impact.note(currency: userSettingsStore.currency),
                    showsFigures: impact.figures.tone != .neutral
                )
                .sensitiveAmount()
            }

            if kind == .saving {
                FormCard {
                    SavingsGoalPickerField(selection: $savingsGoalId, budgetPeriod: budgetPeriod, style: .row)
                }
            }
            if AssetPickerField.isShown(kind: kind, flagEnabled: featureFlags.isNetWorthEnabled) {
                FormCard {
                    AssetPickerField(selection: $assetId, kind: kind)
                }
            }
            // PUL-329 v2 — the goal an income was announced to be drawn from is
            // read-only: the origin is fixed at creation, and a second picker
            // here would suggest the source could be swapped.
            if let source = budgetLine.savingsGoalSource {
                FormCard {
                    SavingsGoalSourceLabel(source: source)
                        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
                }
            }

            if budgetLine.kind == .income, let drawnAssetId = budgetLine.assetId {
                DrawnFromAssetCard(assetId: drawnAssetId)
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task { await loadTemplateAmount() }
        .onChange(of: kind) { _, newKind in
            // Mirror the backend kind-guard: only savings can carry a goal.
            if newKind != .saving { savingsGoalId = nil }
            assetId = nil
        }
    }

    // MARK: - Month context

    private var monthName: String? {
        budgetPeriod.map { Formatters.monthNameInText(for: $0.month) }
    }

    /// « prévus en novembre · avant 600.00 »: "avant" only once the amount differs.
    private var plannedCaption: String? {
        guard let monthName else { return nil }
        guard let amount, amount != initialAmount else {
            return AppLocale.string("prévus en \(monthName)")
        }
        let before = initialAmount.asAmount(for: inputCurrency)
        return AppLocale.string("prévus en \(monthName) · avant \(before)")
    }

    /// The frequency belongs to the model: shown, locked.
    private var frequencyRow: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text("Fréquence")
                .font(PulpeTypography.body)
                .foregroundStyle(Color.textPrimary)
            Spacer()
            Text(budgetLine.recurrence == .fixed ? AppLocale.string("Chaque mois") : AppLocale.string("Une fois"))
                .font(PulpeTypography.body)
                .foregroundStyle(Color.textSecondary)
            Image(systemName: "lock")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textSecondary)
                .accessibilityHidden(true)
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .accessibilityElement(children: .combine)
    }

    /// « Seul novembre change. Ton modèle garde 600.00 et la fréquence se règle là-bas. »
    private var scopeNote: String? {
        guard let monthName else { return nil }
        guard budgetLine.templateLineId != nil else { return AppLocale.string("Seul \(monthName) change.") }
        guard let templateAmount else {
            return AppLocale.string("Seul \(monthName) change. La fréquence se règle dans ton modèle.")
        }
        let kept = templateAmount.asAmount(for: userSettingsStore.currency)
        return AppLocale.string("Seul \(monthName) change. Ton modèle garde \(kept) et la fréquence se règle là-bas.")
    }

    /// Shown once the amount or the nature moves. ponytail: a line typed in another currency
    /// skips it; judging it would need a conversion per keystroke.
    private var availableImpact: BudgetLineEditImpact? {
        guard let ledger, !isAlternateCurrency, let amount, amount > 0,
              amount != budgetLine.amount || kind != budgetLine.kind else { return nil }
        return BudgetLineEditImpact.compute(ledger: ledger, line: budgetLine, amount: amount, kind: kind)
    }

    /// One cheap read of the model's lines; without it the note drops the amount.
    private func loadTemplateAmount() async {
        guard let templateId, let templateLineId = budgetLine.templateLineId else { return }
        let lines = try? await dependencies.templateLines(templateId)
        templateAmount = lines?.first { $0.id == templateLineId }?.amount
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: AppLocale.string("Description"),
            accessibilityLabel: AppLocale.string("Description de la prévision"),
            focusBinding: $focusedField,
            field: .description,
            style: .row,
            onSubmit: {
                guard canSubmit else { return }
                Task { await updateBudgetLine() }
            }
        )
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await updateBudgetLine() }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func updateBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
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

            var data = Self.buildUpdate(
                id: budgetLine.id,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                conversion: conversion,
                tagIds: TagPickerField.updatedTagIds(initial: initialTagIds, current: selectedTagIds)
            )
            // Always emit the link (id or explicit null) so a saving line can be
            // tagged or untagged; the kind-guard clears it for non-saving kinds.
            data.savingsGoalId = .some(kind.savingsGoalLink(savingsGoalId))
            data.assetId = Self.assetChange(line: budgetLine, kind: kind, assetId: assetId)

            let updatedLine = try await dependencies.updateBudgetLine(budgetLine.id, data)
            submitSuccessTrigger.toggle()
            onUpdate(updatedLine)
            toastManager.show(AppLocale.string("Prévision modifiée"))
            dismiss()
        } catch {
            self.error = error
        }
    }

    // MARK: - Pure Helpers (testable)

    static func shouldShowAlternateCurrency(
        for line: BudgetLine,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let lineCurrency = line.originalCurrency else { return false }
        return lineCurrency != userCurrency
    }

    /// Amount to pre-fill in the input. Uses `originalAmount` only when the line is
    /// in an alternate currency — otherwise the converted amount would confuse users.
    static func initialAmount(for line: BudgetLine, userCurrency: SupportedCurrency) -> Decimal {
        if shouldShowAlternateCurrency(for: line, userCurrency: userCurrency),
           let originalAmount = line.originalAmount {
            return originalAmount
        }
        return line.amount
    }

    /// Builds the update DTO. When the line is mono-currency (or flag-off fallback),
    /// currency metadata is omitted so the backend preserves the existing values.
    /// The savings-goal link is applied by the caller (see `updateBudgetLine`).
    static func buildUpdate(
        id: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        conversion: CurrencyConversion?,
        tagIds: [String]? = nil
    ) -> BudgetLineUpdate {
        guard let conversion else {
            return BudgetLineUpdate(
                id: id,
                name: name,
                amount: amount,
                kind: kind,
                isManuallyAdjusted: true,
                tagIds: tagIds
            )
        }
        return BudgetLineUpdate(
            id: id,
            name: name,
            amount: conversion.convertedAmount,
            kind: kind,
            isManuallyAdjusted: true,
            originalAmount: conversion.originalAmount,
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate,
            tagIds: tagIds
        )
    }
}

struct EditBudgetLineDependencies: Sendable {
    var updateBudgetLine: @Sendable (String, BudgetLineUpdate) async throws -> BudgetLine
    var templateLines: @Sendable (String) async throws -> [TemplateLine] = { templateId in
        try await TemplateService.shared.getTemplateLines(templateId: templateId)
    }

    static let live = EditBudgetLineDependencies(
        updateBudgetLine: { id, data in
            try await BudgetLineService.shared.updateBudgetLine(id: id, data: data)
        }
    )
}

extension EditBudgetLineSheet {
    /// Unlike the goal link, only emitted when it moved: an untouched edit must not clear it.
    /// An income's origin is fixed at creation, so it is never touched while it stays an income.
    static func assetChange(line: BudgetLine, kind: TransactionKind, assetId: String?) -> String?? {
        lineAssetChange(initialKind: line.kind, kind: kind, initialAssetId: line.assetId, assetId: assetId)
    }
}

/// Mon patrimoine — the asset an income is drawn from, read-only like the goal source above:
/// the origin is fixed at creation. Nothing when the flag is off or the asset is gone.
private struct DrawnFromAssetCard: View {
    let assetId: String

    @Environment(AssetStore.self) private var assetStore
    @Environment(FeatureFlagsStore.self) private var featureFlags

    var body: some View {
        let name = assetStore.netWorth?.assets.first { $0.id == assetId }?.name
        // A container that always renders: an empty Group never runs its `.task`.
        VStack {
            if featureFlags.isNetWorthEnabled, let name {
                FormCard {
                    Text(AppLocale.string("Pris sur \(name)"))
                        .font(PulpeTypography.bodyLarge)
                        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
                }
            }
        }
        .task { await assetStore.loadIfNeeded() }
    }
}

#Preview {
    EditBudgetLineSheet(
        budgetLine: BudgetLine(
            id: "test",
            budgetId: "budget-1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Test Budget Line",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        userCurrency: .chf
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(SavingsGoalStore())
    .environment(AssetStore())
    .environment(FeatureFlagsStore())
    .environment(TagStore())
}
