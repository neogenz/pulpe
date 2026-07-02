import SwiftUI

/// Create / edit a savings goal (PUL-12). `goal == nil` → create.
/// In edit mode it also drives status changes (Actif / En pause / Atteint —
/// COMPLETED is reversible) and deletion (the backend unlinks prévisions; none
/// are deleted). Target amount is in the account currency (no currency selector
/// in v1, CA27).
struct SavingsGoalFormSheet: View {
    let goal: SavingsGoal?

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(SavingsGoalStore.self) private var store

    @State private var name: String
    @State private var amount: Decimal?
    @State private var amountText: String
    @State private var targetDate: Date
    @State private var status: SavingsGoalStatus
    @State private var isLoading = false
    @State private var error: Error?
    @State private var showDeleteConfirmation = false
    @FocusState private var focusedField: AmountDescriptionField?

    private let currency: SupportedCurrency
    private let accentColor = TransactionKind.saving.color

    init(goal: SavingsGoal?, userCurrency: SupportedCurrency) {
        self.goal = goal
        self.currency = userCurrency
        _name = State(initialValue: goal?.name ?? "")
        _status = State(initialValue: goal?.status ?? .active)

        let amount = goal?.targetAmount
        _amount = State(initialValue: amount)
        let amountString = amount.map {
            Formatters.amountInput(for: userCurrency).string(from: $0 as NSDecimalNumber) ?? ""
        } ?? ""
        _amountText = State(initialValue: amountString)

        let defaultDate = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
        _targetDate = State(initialValue: goal?.targetDateValue ?? defaultDate)
    }

    private var isEditing: Bool { goal != nil }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: isEditing ? "Modifier l'objectif" : "Nouvel objectif",
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: currency,
                accentColor: accentColor
            )
            nameField
            dateField
            if isEditing {
                CapsulePicker(selection: $status, title: "Statut") { item, _ in
                    Text(item.label)
                }
            }

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
            if isEditing {
                deleteButton
            }
        }
        .confirmationDialog(
            "Supprimer cet objectif ?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                Task { await deleteGoal() }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Tes prévisions rattachées seront déliées, jamais supprimées.")
        }
    }

    // MARK: - Fields

    private var nameField: some View {
        FormTextField(
            hint: "Maison, vacances, voiture…",
            text: $name,
            label: "Nom de l'objectif",
            accessibilityLabel: "Nom de l'objectif d'épargne",
            focusBinding: $focusedField,
            field: .description
        )
    }

    private var dateField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Échéance")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
            DatePicker(
                "Échéance",
                selection: $targetDate,
                in: Date()...,
                displayedComponents: .date
            )
            .labelsHidden()
            .datePickerStyle(.compact)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Buttons

    private var saveButton: some View {
        Button {
            Task { await save() }
        } label: {
            Text(isEditing ? "Enregistrer" : "Créer l'objectif")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            showDeleteConfirmation = true
        } label: {
            Text("Supprimer l'objectif")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.destructivePrimary)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    // MARK: - Logic

    private func save() async {
        guard let amount else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil

        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let dateString = SavingsGoalDateFormatter.string(from: targetDate)

        do {
            if let goal {
                _ = try await store.update(
                    id: goal.id,
                    data: SavingsGoalUpdate(
                        name: trimmedName,
                        targetAmount: amount,
                        targetDate: dateString,
                        status: status
                    )
                )
                toastManager.show("Objectif modifié")
            } else {
                _ = try await store.create(
                    SavingsGoalCreate(
                        name: trimmedName,
                        targetAmount: amount,
                        targetDate: dateString,
                        status: .active
                    )
                )
                toastManager.show("Objectif créé")
            }
            dismiss()
        } catch {
            self.error = error
        }
    }

    private func deleteGoal() async {
        guard let goal else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            try await store.delete(id: goal.id)
            toastManager.show("Objectif supprimé")
            dismiss()
        } catch {
            self.error = error
        }
    }
}
