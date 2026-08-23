import SwiftUI

// MARK: - Form atoms

/// The description row and the sticky CTA of the transaction editor, split out to
/// keep the page under the feature's 350-LOC budget (same precedent as
/// `+SavingsGoalSource`). The state they bind is declared non-private on the page.
extension EditTransactionPage {
    var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: AppLocale.string("Description"),
            focusBinding: $focusedField,
            field: .description,
            style: .row
        )
    }

    @ViewBuilder
    func saveButton(for tx: Transaction) -> some View {
        let canSubmit = EditTransactionLogic.isFormValid(
            name: name,
            amount: amount,
            isLoading: isLoading
        )
        Button {
            Task { await save(for: tx) }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }
}
