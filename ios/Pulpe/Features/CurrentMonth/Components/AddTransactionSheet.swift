import SwiftUI

/// Sheet for adding a new transaction
struct AddTransactionSheet: View {
    let budgetId: String
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var transactionDate = Date()
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var pendingQuickAmount: Int?

    private let transactionService = TransactionService.shared
    private let quickAmounts = [10, 15, 20, 30]

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        amount != nil &&
        amount! > 0 &&
        !isLoading
    }

    var body: some View {
        NavigationStack {
            Form {
                // Amount (first for auto-focus)
                Section {
                    CurrencyField(
                        value: $amount,
                        placeholder: "0.00",
                        externalFocus: $isAmountFocused
                    )
                } header: {
                    Text("Montant")
                }

                // Quick amounts
                Section {
                    HStack(spacing: 8) {
                        ForEach(quickAmounts, id: \.self) { quickAmount in
                            Button {
                                if isAmountFocused {
                                    pendingQuickAmount = quickAmount
                                    isAmountFocused = false
                                } else {
                                    amount = Decimal(quickAmount)
                                }
                            } label: {
                                Text("\(quickAmount) CHF")
                                    .font(.subheadline.weight(.medium))
                                    .fixedSize()
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .frame(maxWidth: .infinity)
                                    .background(Color.accentColor.opacity(0.15))
                                    .foregroundStyle(Color.accentColor)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                } header: {
                    Text("Montants rapides")
                }

                // Name
                Section {
                    TextField("Description", text: $name)
                } header: {
                    Text("Description")
                }

                // Kind
                Section {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases, id: \.self) { type in
                            Label(type.label, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Type")
                }

                // Date
                Section {
                    DatePicker(
                        "Date",
                        selection: $transactionDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                } header: {
                    Text("Date")
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
            .navigationTitle("Nouvelle dépense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") {
                        Task { await addTransaction() }
                    }
                    .disabled(!canSubmit)
                }
            }
            .loadingOverlay(isLoading)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    isAmountFocused = true
                }
            }
            .onChange(of: isAmountFocused) { _, isFocused in
                if !isFocused, let quickAmount = pendingQuickAmount {
                    amount = Decimal(quickAmount)
                    pendingQuickAmount = nil
                }
            }
        }
    }

    private func addTransaction() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = TransactionCreate(
            budgetId: budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            transactionDate: transactionDate
        )

        do {
            let transaction = try await transactionService.createTransaction(data)
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
            isLoading = false
        }
    }
}

#Preview {
    AddTransactionSheet(budgetId: "test") { transaction in
        print("Added: \(transaction)")
    }
}
