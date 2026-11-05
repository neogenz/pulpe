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
    /// Available to spend before this line, to show what it changes.
    private let available: Decimal
    private let originalAmount: Decimal

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: AmountDescriptionField?

    /// Create mode
    init(
        kind: TransactionKind,
        currency: SupportedCurrency,
        available: Decimal,
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.isEditing = false
        self.editingId = nil
        self.kind = kind
        self.currency = currency
        self.available = available
        self.originalAmount = 0
        _name = State(initialValue: "")
        _amount = State(initialValue: nil)
        _amountText = State(initialValue: "")
    }

    /// Edit mode — pre-fills fields from existing transaction
    init(
        editing transaction: OnboardingTransaction,
        currency: SupportedCurrency,
        available: Decimal,
        onSave: @escaping (OnboardingTransaction) -> Void
    ) {
        self.onSave = onSave
        self.isEditing = true
        self.editingId = transaction.id
        self.kind = transaction.type
        self.currency = currency
        self.available = available
        self.originalAmount = transaction.amount
        _name = State(initialValue: transaction.name)
        _amount = State(initialValue: transaction.amount)
        let formatted = Formatters.amountInput(for: currency).string(from: transaction.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: formatted)
    }

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0
    }

    var body: some View {
        SheetFormContainer(
            title: isEditing ? AppLocale.string("Modifier") : AppLocale.string("Nouvelle prévision"),
            isLoading: false,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: AppLocale.string("Quel montant ?"),
                currency: currency,
                caption: AppLocale.string("chaque mois")
            )

            FormTextField(
                hint: AppLocale.string("Ex : Spotify, Salle de sport..."),
                text: $name,
                label: AppLocale.string("Description"),
                accessibilityLabel: AppLocale.string("Description de la prévision"),
                focusBinding: $focusedField,
                field: .description
            )

            if let amount, amount > 0 { impact(for: amount) }
        }
        .safeAreaInset(edge: .bottom) {
            saveButton
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.md)
                .background(Color.sheetBackground)
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Impact

    /// What the line does to "Disponible à dépenser", before it is added.
    private func impact(for amount: Decimal) -> some View {
        let sign: Decimal = kind == .income ? 1 : -1
        let before = available - sign * originalAmount
        let note: String = switch kind {
        case .income: AppLocale.string("Ce revenu s'ajoute à ton disponible et revient chaque mois.")
        case .expense: AppLocale.string("Elle rejoint tes charges fixes et revient chaque mois.")
        case .saving: AppLocale.string("Elle rejoint ton épargne prévue et revient chaque mois.")
        }
        return ImpactBlock(
            title: AppLocale.string("Disponible à dépenser"),
            before: before,
            after: before + sign * amount,
            currency: currency,
            note: note,
            tone: kind == .income ? .ok : .neutral
        )
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
    AddCustomExpenseSheet(kind: .expense, currency: .chf, available: 3178.5) { tx in
        print("Added: \(tx.name) - \(tx.amount)")
    }
}
