import SwiftUI

/// Sheet for editing an existing template line — hero amount layout
struct EditTemplateLineSheet: View {
    let templateLine: TemplateLine
    let onUpdate: (TemplateLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var recurrence: TransactionRecurrence
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText: String
    @State private var submitSuccessTrigger = false

    private let templateService = TemplateService.shared

    init(templateLine: TemplateLine, onUpdate: @escaping (TemplateLine) -> Void) {
        self.templateLine = templateLine
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _amount = State(initialValue: templateLine.amount)
        _kind = State(initialValue: templateLine.kind)
        _recurrence = State(initialValue: templateLine.recurrence)
        let amountString = Formatters.amountInput.string(from: templateLine.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(title: "Modifier la ligne", isLoading: isLoading, autoFocus: $isAmountFocused) {
            HeroAmountField(
                amount: $amount, amountText: $amountText,
                isFocused: $isAmountFocused, accentColor: kind.color
            )
            descriptionField
            KindToggle(selection: $kind)
            recurrenceSelector

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Description

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Description")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
            TextField(kind.descriptionPlaceholder, text: $name)
                .font(PulpeTypography.bodyLarge)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.outlineVariant.opacity(0.5), lineWidth: 1)
                )
                .accessibilityLabel("Nom de la ligne du modèle")
        }
    }

    // MARK: - Recurrence Selector

    private var recurrenceSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Récurrence")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.pulpeTextTertiary)

            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(TransactionRecurrence.allCases, id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: DesignTokens.Animation.fast)) {
                            recurrence = type
                        }
                    } label: {
                        Text(type.label)
                            .font(PulpeTypography.buttonSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, DesignTokens.Spacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(recurrence == type ? Color.pulpePrimary : Color.surfaceContainer)
                            .foregroundStyle(recurrence == type ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await updateTemplateLine() }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func updateTemplateLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        let data = TemplateLineUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            recurrence: recurrence
        )

        do {
            let updatedLine = try await templateService.updateTemplateLine(id: templateLine.id, data: data)
            submitSuccessTrigger.toggle()
            onUpdate(updatedLine)
            toastManager.show("Ligne modifiée")
            dismiss()
        } catch {
            self.error = error
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
    .environment(ToastManager())
}
