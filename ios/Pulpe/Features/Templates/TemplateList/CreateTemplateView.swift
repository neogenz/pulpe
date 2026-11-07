import SwiftUI

struct CreateTemplateView: View {
    private enum TemplateFormField: Hashable {
        case name
        case description
    }

    let onCreate: (BudgetTemplate) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name = ""
    @State private var description = ""
    @State private var isDefault = false
    @State private var lines: [TemplateLineInput] = []
    @State private var showAddLine = false
    @State private var isCreating = false
    @State private var error: Error?
    @FocusState private var focusedField: TemplateFormField?
    @State private var submitSuccessTrigger = false

    private let templateService = TemplateService.shared

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !isCreating
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Nouveau modèle"),
            isLoading: isCreating,
            focus: $focusedField,
            focusOrder: [.name, .description]
        ) {
            FormTextField(
                hint: AppLocale.string("Nom du modèle"),
                text: $name,
                label: AppLocale.string("Nom"),
                accessibilityLabel: AppLocale.string("Nom du modèle"),
                focusBinding: $focusedField,
                field: .name
            )

            FormTextField(
                hint: AppLocale.string("Facultatif"),
                text: $description,
                label: AppLocale.string("Description"),
                accessibilityLabel: AppLocale.string("Description du modèle"),
                focusBinding: $focusedField,
                field: .description
            )

            FormCard {
                Toggle(isOn: $isDefault) {
                    Text("Modèle par défaut")
                        .font(PulpeTypography.bodyLarge)
                }
                .tint(.pulpePrimary)
                .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            }

            linesSection

            if !lines.isEmpty {
                lineTotals
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            createButton
        }
        .sheet(isPresented: $showAddLine) {
            AddTemplateLineSheet(
                templateName: name.trimmingCharacters(in: .whitespaces).isEmpty
                    ? AppLocale.string("ce modèle")
                    : name.trimmingCharacters(in: .whitespaces)
            ) { line in
                lines.append(line)
            }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Lines Section

    /// « Lignes · 3 »: one card, a row per line with its remove button, then the add row.
    private var linesSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(AppLocale.string("Lignes") + " · \(lines.count)")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.onSurfaceVariant)
                .padding(.leading, DesignTokens.Spacing.xs)

            FormCard {
                ForEach(lines) { line in
                    TemplateLineInputRow(line: line) {
                        withAnimation(DesignTokens.Animation.defaultSpring) {
                            lines.removeAll { $0.id == line.id }
                        }
                    }
                    FormRowDivider()
                }
                SectionAddRow(title: AppLocale.string("Ajouter une ligne")) {
                    showAddLine = true
                }
            }
        }
    }

    // MARK: - Totals

    /// « Disponible de départ 4'110.00 », « 6'200.00 de revenus moins 2'090.00 prévus ».
    private var lineTotals: some View {
        let totals = calculateTotals()
        let currency = userSettingsStore.currency
        return ImpactBlock(
            title: AppLocale.string("Disponible de départ"),
            before: nil,
            after: totals.balance,
            currency: currency,
            note: AppLocale.string("""
                \(totals.income.asAmount(for: currency)) de revenus moins \
                \(totals.expenses.asAmount(for: currency)) prévus
                """)
        )
        .sensitiveAmount()
    }

    // MARK: - Create Button

    private var createButton: some View {
        Button {
            Task { await createTemplate() }
        } label: {
            Text("Créer le modèle")
        }
        .disabled(!canCreate)
        .primaryButtonStyle(isEnabled: canCreate)
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
            submitSuccessTrigger.toggle()
            onCreate(result.template)
            toastManager.show(AppLocale.string("Modèle créé"))
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

    @Environment(UserSettingsStore.self) private var userSettingsStore

    private var subtitle: String {
        line.kind.label + " · " + TemplatePresentation.whenLabel(line.recurrence).lowercased()
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            PulpeListRow(title: line.name, subtitle: subtitle, showsChevron: false) {
                Text(verbatim: (line.kind == .income ? "+" : "")
                    + line.amount.asAmount(for: userSettingsStore.currency))
                    .sensitiveAmount()
            }

            Button(action: onDelete) {
                Image(systemName: "minus")
                    .font(.system(size: DesignTokens.Checkbox.glyphSize, weight: .bold))
                    .foregroundStyle(Color.textSecondary)
                    .frame(width: DesignTokens.Control.addRowDisc, height: DesignTokens.Control.addRowDisc)
                    .background(Color.sunk, in: Circle())
                    // 28pt visual, 44pt hit area.
                    .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(AppLocale.string("Retirer la ligne"))
        }
    }
}

// MARK: - Add Line Sheet — hero amount layout

struct AddTemplateLineSheet: View {
    private enum FormField: Hashable {
        case amount
        case name
    }

    /// The model being built, for the « Quand ? » sentence.
    let templateName: String
    let onAdd: (TemplateLineInput) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var recurrence: TransactionRecurrence = .fixed
    @FocusState private var focusedField: FormField?
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
        if (amount ?? 0) <= 0 { return AppLocale.string("Ajoute un montant") }
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            return AppLocale.string("Ajoute une description")
        }
        return nil
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Nouvelle ligne"),
            isLoading: false,
            focus: $focusedField,
            focusOrder: [.amount, .name]
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: userSettingsStore.currency
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                amountField: .amount,
                color: kind.color,
                currency: userSettingsStore.currency
            )
            .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField
            KindToggle(selection: $kind)
            TemplateWhenSection(recurrence: $recurrence, templateName: templateName)
            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: AppLocale.string("Nom de la ligne"),
            text: $name,
            accessibilityLabel: AppLocale.string("Nom de la ligne budgétaire"),
            focusBinding: $focusedField,
            field: .name
        )
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
    .environment(ToastManager())
    .environment(UserSettingsStore())
}

struct LineTotals: Sendable {
    let income: Decimal
    let expenses: Decimal
    let balance: Decimal
}
