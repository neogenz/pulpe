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
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Revenus: \(totals.income.asCHF)")
                            Text("Dépenses: \(totals.expenses.asCHF)")
                            Text("Solde: \(totals.balance.asCHF)")
                                .foregroundStyle(totals.balance >= 0 ? .green : .red)
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
            VStack(alignment: .leading, spacing: 4) {
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
                    .foregroundStyle(.red)
            }
        }
    }
}

// MARK: - Add Line Sheet

struct AddTemplateLineSheet: View {
    let onAdd: (TemplateLineInput) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var recurrence: TransactionRecurrence = .fixed

    private var canAdd: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && amount != nil && amount! > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Nom", text: $name)

                CurrencyField(value: $amount, label: "Montant")

                Picker("Type", selection: $kind) {
                    ForEach(TransactionKind.allCases, id: \.self) { type in
                        Text(type.label).tag(type)
                    }
                }

                Picker("Récurrence", selection: $recurrence) {
                    ForEach(TransactionRecurrence.allCases, id: \.self) { type in
                        Text(type.label).tag(type)
                    }
                }
            }
            .navigationTitle("Nouvelle ligne")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") {
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
                    }
                    .disabled(!canAdd)
                }
            }
        }
    }
}

#Preview {
    CreateTemplateView { template in
        print("Created: \(template)")
    }
}
