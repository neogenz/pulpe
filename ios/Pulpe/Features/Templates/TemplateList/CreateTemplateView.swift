import SwiftUI

struct CreateTemplateView: View {
    let onCreate: (BudgetTemplate) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var isDefault = false
    @State private var lines: [TemplateLineInput] = []
    @State private var showAddLine = false
    @State private var isCreating = false
    @State private var error: Error?

    private let templateService = TemplateService.shared

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !isCreating
    }

    var body: some View {
        NavigationStack {
            Form {
                // Basic info
                Section {
                    TextField("Nom du modèle", text: $name)

                    TextField("Description (optionnel)", text: $description)

                    Toggle("Modèle par défaut", isOn: $isDefault)
                } header: {
                    Text("Informations")
                }

                // Lines
                Section {
                    ForEach(lines) { line in
                        TemplateLineInputRow(line: line) {
                            lines.removeAll { $0.id == line.id }
                        }
                    }

                    Button {
                        showAddLine = true
                    } label: {
                        Label("Ajouter une ligne", systemImage: "plus")
                    }
                } header: {
                    Text("Lignes budgétaires")
                } footer: {
                    if !lines.isEmpty {
                        let totals = calculateTotals()
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                            Text("Revenus: \(totals.income.asCHF)")
                                .sensitiveAmount()
                            Text("Dépenses: \(totals.expenses.asCHF)")
                                .sensitiveAmount()
                            Text("Solde: \(totals.balance.asCHF)")
                                .foregroundStyle(
                                    totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget
                                )
                                .sensitiveAmount()
                        }
                    }
                }

                // Error
                if let error {
                    Section {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            self.error = nil
                        }
                    }
                }
            }
            .navigationTitle("Nouveau modèle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        Task { await createTemplate() }
                    }
                    .disabled(!canCreate)
                }
            }
            .sheet(isPresented: $showAddLine) {
                AddTemplateLineSheet { line in
                    lines.append(line)
                }
            }
            .loadingOverlay(isCreating, message: "Création...")
        }
        .standardSheetPresentation()
    }

    private func calculateTotals() -> LineTotals {
        let income = lines.filter { $0.kind == .income }.reduce(Decimal.zero) { $0 + $1.amount }
        let expenses = lines.filter { $0.kind.isOutflow }.reduce(Decimal.zero) { $0 + $1.amount }
        return LineTotals(income: income, expenses: expenses, balance: income - expenses)
    }

    private func createTemplate() async {
        isCreating = true
        defer { isCreating = false }
        error = nil

        let data = BudgetTemplateCreate(
            name: name.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description.trimmingCharacters(in: .whitespaces),
            isDefault: isDefault,
            lines: lines.map { line in
                TemplateLineCreate(
                    name: line.name,
                    amount: line.amount,
                    kind: line.kind,
                    recurrence: line.recurrence,
                    description: ""
                )
            }
        )

        do {
            let result = try await templateService.createTemplate(data)
            onCreate(result.template)
            dismiss()
        } catch {
            self.error = error
        }
    }
}

// MARK: - Template Line Input

struct TemplateLineInput: Identifiable {
    let id = UUID()
    var name: String
    var amount: Decimal
    var kind: TransactionKind
    var recurrence: TransactionRecurrence
}

struct TemplateLineInputRow: View {
    let line: TemplateLineInput
    let onDelete: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(line.name)
                    .font(PulpeTypography.subheadline)

                HStack {
                    KindBadge(line.kind, style: .compact)
                    RecurrenceBadge(line.recurrence, style: .compact)
                }
            }

            Spacer()

            CurrencyText(line.amount)
                .foregroundStyle(line.kind.color)

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundStyle(Color.errorPrimary)
            }
            .iconButtonStyle()
        }
    }
}

// MARK: - Add Line Sheet — hero amount layout

struct AddTemplateLineSheet: View {
    let onAdd: (TemplateLineInput) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var recurrence: TransactionRecurrence = .fixed
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
        guard !canSubmit, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
        return nil
    }

    var body: some View {
        SheetFormContainer(title: "Nouvelle ligne", isLoading: false, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                accentColor: kind.color
            )
            QuickAmountChips(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused, color: kind.color)
                .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField
            recurrenceSelector
            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            placeholder: "Nom de la ligne",
            text: $name,
            label: "Description",
            accessibilityLabel: "Nom de la ligne budgétaire"
        )
    }

    // MARK: - Recurrence Selector

    private var recurrenceSelector: some View {
        CapsulePicker(selection: $recurrence, title: "Récurrence") { type in
            Text(type.label)
        }
    }

    // MARK: - Add Button

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                if let amount {
                    submitSuccessTrigger.toggle()
                    let line = TemplateLineInput(
                        name: name.trimmingCharacters(in: .whitespaces),
                        amount: amount,
                        kind: kind,
                        recurrence: recurrence
                    )
                    onAdd(line)
                    dismiss()
                }
            } label: {
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
}

#Preview {
    CreateTemplateView { template in
        print("Created: \(template)")
    }
}

struct LineTotals: Sendable {
    let income: Decimal
    let expenses: Decimal
    let balance: Decimal
}
