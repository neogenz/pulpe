import SwiftUI

/// Sheet for editing an existing template line
struct EditTemplateLineSheet: View {
    let templateLine: TemplateLine
    let onUpdate: (TemplateLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var isLoading = false
    @State private var error: Error?

    private let templateService = TemplateService.shared

    init(templateLine: TemplateLine, onUpdate: @escaping (TemplateLine) -> Void) {
        self.templateLine = templateLine
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _amount = State(initialValue: templateLine.amount)
        _kind = State(initialValue: templateLine.kind)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Description", text: $name)
                        .font(PulpeTypography.bodyLarge)
                        .listRowBackground(Color.surfaceCard)
                } header: {
                    Text("Description")
                        .font(PulpeTypography.labelLarge)
                }

                Section {
                    CurrencyField(value: $amount, placeholder: "0.00")
                        .listRowBackground(Color.surfaceCard)
                } header: {
                    Text("Montant")
                        .font(PulpeTypography.labelLarge)
                }

                Section {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases, id: \.self) { type in
                            Label(type.label, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.surfaceCard)
                } header: {
                    Text("Type")
                        .font(PulpeTypography.labelLarge)
                }

                if let error {
                    Section {
                        ErrorBanner(message: error.localizedDescription) {
                            self.error = nil
                        }
                    }
                }
            }
            .navigationTitle("Modifier la ligne")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Enregistrer") {
                        Task { await updateTemplateLine() }
                    }
                    .disabled(!canSubmit)
                }
            }
            .loadingOverlay(isLoading)
        }
    }

    private func updateTemplateLine() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = TemplateLineUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind
        )

        do {
            let updatedLine = try await templateService.updateTemplateLine(id: templateLine.id, data: data)
            onUpdate(updatedLine)
            dismiss()
        } catch {
            self.error = error
            isLoading = false
        }
    }
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
}
