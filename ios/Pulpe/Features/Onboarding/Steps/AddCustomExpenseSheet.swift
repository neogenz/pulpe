import SwiftUI

/// Sheet form for creating or editing a custom transaction during onboarding.
/// No API call — returns data via callback.
struct AddCustomExpenseSheet: View {
    let onSave: (OnboardingTransaction) -> Void
    let availableKinds: [TransactionKind]
    let isEditing: Bool
    /// When non-nil, the saved transaction reuses this id so analytics, deep-links,
    /// and downstream lookups stay stable across an inline edit. nil in create mode.
    private let editingId: UUID?

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var kind: TransactionKind
    @State private var submitSuccessTrigger = false
    @FocusState private var isAmountFocused: Bool
    @FocusState private var isDescriptionFocused: Bool

    /// Create mode
    init(
        defaultKind: TransactionKind = .expense,
        availableKinds: [TransactionKind] = [.expense, .saving, .income],
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.availableKinds = availableKinds
        self.isEditing = false
        self.editingId = nil
        _name = State(initialValue: "")
        _amount = State(initialValue: nil)
        _amountText = State(initialValue: "")
        _kind = State(initialValue: defaultKind)
    }

    /// Edit mode — pre-fills fields from existing transaction
    init(
        editing transaction: OnboardingTransaction,
        availableKinds: [TransactionKind] = [.expense, .saving, .income],
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.availableKinds = availableKinds
        self.isEditing = true
        self.editingId = transaction.id
        _name = State(initialValue: transaction.name)
        _amount = State(initialValue: transaction.amount)
        let formatted = Formatters.amountInput.string(from: transaction.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: formatted)
        _kind = State(initialValue: transaction.type)
    }

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0
    }

    var body: some View {
        SheetFormContainer(
            title: isEditing ? "Modifier" : "Nouvelle prévision",
            isLoading: false,
            autoFocus: $isAmountFocused,
            descriptionFocus: $isDescriptionFocused
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                hint: "Quel montant ?"
            )

            FormTextField(
                hint: "Ex : Spotify, Salle de sport...",
                text: $name,
                label: "Description",
                accessibilityLabel: "Description de la prévision",
                focusBinding: $isDescriptionFocused
            )

            if availableKinds.count > 1 {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text("Type")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.onSurfaceVariant)

                    Picker("Type", selection: $kind) {
                        ForEach(availableKinds, id: \.self) { k in
                            Text(k.label).tag(k)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            // Preserve the original id when editing so analytics, deep-links, and any
            // downstream UUID-based lookups stay stable across an inline amount/name edit.
            let tx = OnboardingTransaction(
                id: editingId ?? UUID(),
                amount: amount ?? 0,
                type: kind,
                name: name.trimmingCharacters(in: .whitespaces)
            )
            submitSuccessTrigger.toggle()
            onSave(tx)
            dismiss()
        } label: {
            Text(isEditing ? "Enregistrer" : "Ajouter")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }
}

#Preview {
    AddCustomExpenseSheet { tx in
        print("Added: \(tx.name) - \(tx.amount)")
    }
}
