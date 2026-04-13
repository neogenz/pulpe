import SwiftUI

/// Sheet form for creating or editing a custom transaction during onboarding.
/// No API call — returns data via callback.
///
/// Each call site (`ChargesStep`, `SavingsStep`, `IncomeStep`) instantiates the
/// sheet with a fixed `kind`. There's intentionally no in-sheet type picker —
/// the step context already tells the user which kind they're adding.
struct AddCustomExpenseSheet: View {
    let onSave: (OnboardingTransaction) -> Void
    let isEditing: Bool
    /// When non-nil, the saved transaction reuses this id so analytics, deep-links,
    /// and downstream lookups stay stable across an inline edit. nil in create mode.
    private let editingId: UUID?
    private let kind: TransactionKind
    private let currency: SupportedCurrency

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @FocusState private var isAmountFocused: Bool
    @FocusState private var isDescriptionFocused: Bool

    /// Create mode
    init(
        kind: TransactionKind,
        currency: SupportedCurrency,
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.isEditing = false
        self.editingId = nil
        self.kind = kind
        self.currency = currency
        _name = State(initialValue: "")
        _amount = State(initialValue: nil)
        _amountText = State(initialValue: "")
    }

    /// Edit mode — pre-fills fields from existing transaction
    init(
        editing transaction: OnboardingTransaction,
        currency: SupportedCurrency,
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.isEditing = true
        self.editingId = transaction.id
        self.kind = transaction.type
        self.currency = currency
        _name = State(initialValue: transaction.name)
        _amount = State(initialValue: transaction.amount)
        let formatted = Formatters.amountInput.string(from: transaction.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: formatted)
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
                hint: "Quel montant ?",
                currency: currency
            )

            FormTextField(
                hint: "Ex : Spotify, Salle de sport...",
                text: $name,
                label: "Description",
                accessibilityLabel: "Description de la prévision",
                focusBinding: $isDescriptionFocused
            )

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
    AddCustomExpenseSheet(kind: .expense, currency: .chf) { tx in
        print("Added: \(tx.name) - \(tx.amount)")
    }
}
