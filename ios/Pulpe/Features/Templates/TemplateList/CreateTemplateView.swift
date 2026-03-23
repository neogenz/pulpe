import SwiftUI

struct CreateTemplateView: View {
    let onCreate: (BudgetTemplate) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name = ""
    @State private var description = ""
    @State private var isDefault = false
    @State private var lines: [TemplateLineInput] = []
    @State private var showAddLine = false
    @State private var isCreating = false
    @State private var error: Error?
    @FocusState private var isNameFocused: Bool
    @FocusState private var isDescriptionFocused: Bool
    @State private var submitSuccessTrigger = false

    private let templateService = TemplateService.shared

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !isCreating
    }

    var body: some View {
        SheetFormContainer(
            title: "Nouveau modèle",
            isLoading: isCreating,
            autoFocus: $isNameFocused,
            descriptionFocus: $isDescriptionFocused
        ) {
            // Name
            FormTextField(
                hint: "Nom du modèle",
                text: $name,
                label: "Nom",
                accessibilityLabel: "Nom du modèle",
                focusBinding: $isNameFocused
            )

            // Description
            FormTextField(
                hint: "Description (optionnel)",
                text: $description,
                label: "Description",
                accessibilityLabel: "Description du modèle",
                focusBinding: $isDescriptionFocused
            )

            // Default toggle
            defaultToggle

            // Lines
            linesSection

            // Error
            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            // Create button
            createButton
        }
        .sheet(isPresented: $showAddLine) {
            AddTemplateLineSheet { line in
                lines.append(line)
            }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Default Toggle

    private var defaultToggle: some View {
        Toggle(isOn: $isDefault) {
            Text("Modèle par défaut")
                .font(PulpeTypography.bodyLarge)
        }
        .tint(.pulpePrimary)
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Lines Section

    private var linesSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Lignes budgétaires")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            VStack(spacing: 0) {
                ForEach(lines) { line in
                    if line.id != lines.first?.id {
                        Divider().padding(.horizontal, DesignTokens.Spacing.lg)
                    }
                    TemplateLineInputRow(line: line) {
                        withAnimation(.easeInOut(duration: DesignTokens.Animation.fast)) {
                            lines.removeAll { $0.id == line.id }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.vertical, DesignTokens.Spacing.md)
                }

                if !lines.isEmpty {
                    Divider().padding(.horizontal, DesignTokens.Spacing.lg)
                }

                Button {
                    showAddLine = true
                } label: {
                    Label("Ajouter une ligne", systemImage: "plus")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.pulpePrimary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.md)
            }
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))

            // Totals
            if !lines.isEmpty {
                lineTotals
            }
        }
    }

    // MARK: - Totals

    private var lineTotals: some View {
        let totals = calculateTotals()
        return HStack(spacing: DesignTokens.Spacing.lg) {
            totalItem(label: "Revenus", amount: totals.income, color: .financialIncome)
            totalItem(label: "Dépenses", amount: totals.expenses, color: .financialExpense)
            totalItem(label: "Solde", amount: totals.balance,
                      color: totals.balance >= 0 ? .financialSavings : .financialOverBudget)
        }
        .padding(.top, DesignTokens.Spacing.xs)
    }

    private func totalItem(label: String, amount: Decimal, color: Color) -> some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(label)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.onSurfaceVariant)
            Text(amount.asCompactCHF)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(color)
                .sensitiveAmount()
        }
        .frame(maxWidth: .infinity)
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
            toastManager.show("Modèle créé")
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
        HStack(spacing: DesignTokens.Spacing.md) {
            // Kind icon circle (matches TemplateLineRow / BudgetLineRow)
            Circle()
                .fill(line.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                .overlay {
                    Image(systemName: line.kind.icon)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(line.kind.color)
                }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(line.name)
                    .font(PulpeTypography.listRowTitle)
                    .lineLimit(1)

                Text(line.recurrence.label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer(minLength: 8)

            Text(line.amount.asAmount)
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(line.kind.color)
                .sensitiveAmount()

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
    @FocusState private var isDescriptionFocused: Bool
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
        SheetFormContainer(
            title: "Nouvelle ligne",
            isLoading: false,
            autoFocus: $isAmountFocused,
            descriptionFocus: $isDescriptionFocused
        ) {
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
            hint: "Nom de la ligne",
            text: $name,
            label: "Description",
            accessibilityLabel: "Nom de la ligne budgétaire",
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
}

struct LineTotals: Sendable {
    let income: Decimal
    let expenses: Decimal
    let balance: Decimal
}
