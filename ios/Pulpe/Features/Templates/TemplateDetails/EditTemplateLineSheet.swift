import SwiftUI

/// Sheet for editing an existing template line — hero amount layout
struct EditTemplateLineSheet: View {
    let templateLine: TemplateLine
    let onUpdate: (TemplateLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var recurrence: TransactionRecurrence
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @FocusState private var isDescriptionFocused: Bool
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State private var showPropagationAlert = false
    @State private var usageData: TemplateUsageData?
    @State private var pendingUpdate: TemplateLineUpdate?

    private let dependencies: EditTemplateLineDependencies

    init(
        templateLine: TemplateLine,
        dependencies: EditTemplateLineDependencies = .live,
        onUpdate: @escaping (TemplateLine) -> Void
    ) {
        self.templateLine = templateLine
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _amount = State(initialValue: templateLine.amount)
        _kind = State(initialValue: templateLine.kind)
        _recurrence = State(initialValue: templateLine.recurrence)
        let amountString = Formatters.amountInput.string(from: templateLine.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: "Modifier la ligne",
            isLoading: isLoading,
            autoFocus: $isAmountFocused,
            descriptionFocus: $isDescriptionFocused
        ) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount, amountText: $amountText,
                isFocused: $isAmountFocused, accentColor: kind.color
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
            usageData = try? await dependencies.checkTemplateUsage(templateLine.templateId)
        }
        .alert("Propager aux budgets ?", isPresented: $showPropagationAlert) {
            Button("Propager") {
                Task { await saveAndPropagateToBudgets() }
            }
            Button("Modèle uniquement") {
                Task { await saveTemplateOnly() }
            }
            Button("Annuler", role: .cancel) {
                pendingUpdate = nil
            }
        } message: {
            Text("""
                Ce modèle est utilisé par \(usageData?.propagationBudgetCount ?? 0) budget(s).\n\n\
                « Propager » appliquera les modifications aux budgets en cours et futurs. \
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
            focusBinding: $isDescriptionFocused
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
        pendingUpdate = TemplateLineUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            recurrence: recurrence
        )

        let budgetCount = usageData?.propagationBudgetCount ?? 0
        if budgetCount > 0 {
            showPropagationAlert = true
        } else {
            await saveTemplateOnly()
        }
    }

    private func saveTemplateOnly() async {
        guard let data = pendingUpdate else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let updatedLine = try await dependencies.updateTemplateLine(templateLine.templateId, templateLine.id, data)
            finishSave(updatedLine: updatedLine, message: "Ligne modifiée")
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
                    description: data.description
                )],
                propagateToBudgets: true
            )
            let response = try await dependencies.bulkUpdateWithPropagation(templateLine.templateId, operations)
            let updatedLine = response.updated.first ?? templateLine
            let affectedCount = response.propagation?.affectedBudgetsCount ?? 0
            let message = affectedCount > 0
                ? "Ligne modifiée — \(affectedCount) budget(s) mis à jour"
                : "Ligne modifiée"
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
        )
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
}
