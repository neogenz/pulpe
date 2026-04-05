import SwiftUI

/// Sheet form for creating a custom expense or saving during onboarding.
/// No API call — returns data via callback.
struct AddCustomExpenseSheet: View {
    let onAdd: (OnboardingTransaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var amountText = ""
    @State private var kind: TransactionKind = .expense
    @State private var submitSuccessTrigger = false
    @FocusState private var isAmountFocused: Bool
    @FocusState private var isDescriptionFocused: Bool

    private static let availableKinds: [TransactionKind] = [.expense, .saving]

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (amount ?? 0) > 0
    }

    var body: some View {
        SheetFormContainer(
            title: "Nouvelle prévision",
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
                accessibilityLabel: "Description de la dépense",
                focusBinding: $isDescriptionFocused
            )

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Type")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)

                Picker("Type", selection: $kind) {
                    ForEach(Self.availableKinds, id: \.self) { k in
                        Text(k.label).tag(k)
                    }
                }
                .pickerStyle(.segmented)
            }

            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            let tx = OnboardingTransaction(
                amount: amount ?? 0,
                type: kind,
                name: name.trimmingCharacters(in: .whitespaces),
                description: nil,
                expenseType: .fixed,
                isRecurring: true
            )
            submitSuccessTrigger.toggle()
            onAdd(tx)
            dismiss()
        } label: {
            Text("Ajouter")
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
