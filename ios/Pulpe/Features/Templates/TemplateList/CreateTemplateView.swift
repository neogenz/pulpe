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
                            Text("Dépenses: \(totals.expenses.asCHF)")
                            Text("Solde: \(totals.balance.asCHF)")
                                .foregroundStyle(totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget)
                        }
                    }
                }

                // Error
                if let error {
                    Section {
                        ErrorBanner(message: error.localizedDescription) {
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
    }

    private func calculateTotals() -> (income: Decimal, expenses: Decimal, balance: Decimal) {
        let income = lines.filter { $0.kind == .income }.reduce(Decimal.zero) { $0 + $1.amount }
        let expenses = lines.filter { $0.kind.isOutflow }.reduce(Decimal.zero) { $0 + $1.amount }
        return (income, expenses, income - expenses)
    }

    private func createTemplate() async {
        isCreating = true
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
            isCreating = false
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
                    .font(.subheadline)

                HStack {
                    KindBadge(line.kind, style: .compact)
                    RecurrenceBadge(line.recurrence, style: .compact)
                }
            }

            Spacer()

            CurrencyText(line.amount)
                .foregroundStyle(line.kind.color)

            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
                    .foregroundStyle(Color.errorPrimary)
            }
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

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0
    }

    private static let amountFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = "'"
        return formatter
    }()

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Self.amountFormatter.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    heroAmountSection
                    nameField
                    kindSelector
                    recurrenceSelector
                    addButton
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.xxxl)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .background(Color.surfacePrimary)
            .navigationTitle("Nouvelle ligne")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .dismissKeyboardOnTap()
            .task {
                try? await Task.sleep(for: .milliseconds(200))
                isAmountFocused = true
            }
        }
    }

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("CHF")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textTertiary)

            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused($isAmountFocused)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        parseAmount(newValue)
                    }

                Text(displayAmount)
                    .font(PulpeTypography.amountHero)
                    .foregroundStyle((amount ?? 0) > 0 ? Color.textPrimary : Color.textTertiary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: 0.2), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            RoundedRectangle(cornerRadius: 1)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(0.3))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: 0.2), value: isAmountFocused)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
    }

    // MARK: - Name

    private var nameField: some View {
        TextField("Nom de la ligne", text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Kind Selector

    private var kindSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Type")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textTertiary)

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(TransactionKind.allCases, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            kind = type
                        }
                    } label: {
                        Label(type.label, systemImage: type.icon)
                            .font(PulpeTypography.buttonSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, DesignTokens.Spacing.sm + 2)
                            .frame(maxWidth: .infinity)
                            .background(kind == type ? Color.pulpePrimary : Color.surfaceSecondary)
                            .foregroundStyle(kind == type ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Recurrence Selector

    private var recurrenceSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Récurrence")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textTertiary)

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(TransactionRecurrence.allCases, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            recurrence = type
                        }
                    } label: {
                        Text(type.label)
                            .font(PulpeTypography.buttonSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, DesignTokens.Spacing.sm + 2)
                            .frame(maxWidth: .infinity)
                            .background(recurrence == type ? Color.pulpePrimary : Color.surfaceSecondary)
                            .foregroundStyle(recurrence == type ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            if let amount {
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
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(Color.textOnPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.pulpePrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                .opacity(canAdd ? 1 : 0.4)
        }
        .disabled(!canAdd)
        .buttonStyle(.plain)
    }

    // MARK: - Logic

    private func parseAmount(_ text: String) {
        let cleaned = text
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }

        let components = cleaned.split(separator: ".")
        let sanitized: String
        if components.count > 1 {
            let fractional = String(components.dropFirst().joined().prefix(2))
            sanitized = "\(components[0]).\(fractional)"
        } else {
            sanitized = cleaned
        }

        if let decimal = Decimal(string: sanitized) {
            amount = decimal
        } else if sanitized.isEmpty {
            amount = nil
        }
    }
}

#Preview {
    CreateTemplateView { template in
        print("Created: \(template)")
    }
}
