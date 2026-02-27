import SwiftUI

/// Sheet for editing an existing template line — hero amount layout
struct EditTemplateLineSheet: View {
    let templateLine: TemplateLine
    let onUpdate: (TemplateLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var recurrence: TransactionRecurrence
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText: String

    private let templateService = TemplateService.shared

    init(templateLine: TemplateLine, onUpdate: @escaping (TemplateLine) -> Void) {
        self.templateLine = templateLine
        self.onUpdate = onUpdate
        _name = State(initialValue: templateLine.name)
        _amount = State(initialValue: templateLine.amount)
        _kind = State(initialValue: templateLine.kind)
        _recurrence = State(initialValue: templateLine.recurrence)
        _amountText = State(initialValue: templateLine.amount > 0 ? "\(templateLine.amount)" : "")
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Formatters.amountInput.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                heroAmountSection
                descriptionField
                kindSelector
                recurrenceSelector

                if let error {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                        self.error = nil
                    }
                }

                saveButton
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xl)
        }
        .background(Color.surfacePrimary)
        .modernSheet(title: "Modifier la ligne")
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
        .task {
            try? await Task.sleep(for: .milliseconds(200))
            isAmountFocused = true
        }
    }

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(DesignTokens.AmountInput.currencyCode)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textTertiary)

            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused($isAmountFocused)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        parseAmount(newValue)
                    }

                Text(displayAmount)
                    .font(PulpeTypography.amountHero)
                    .foregroundStyle((amount ?? 0) > 0 ? Color.textPrimary : Color.textTertiary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.hairline)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(DesignTokens.Opacity.strong))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isAmountFocused)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField("Description", text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Kind Selector

    private var kindSelector: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(TransactionKind.allCases, id: \.self) { type in
                Button {
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.fast)) {
                        kind = type
                    }
                } label: {
                    Label(type.label, systemImage: type.icon)
                        .font(PulpeTypography.buttonSecondary)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm + 2)
                        .frame(maxWidth: .infinity)
                        .background(kind == type ? Color.pulpePrimary : Color.surfaceSecondary)
                        .foregroundStyle(kind == type ? Color.textOnPrimary : Color.textPrimary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Recurrence Selector

    private var recurrenceSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Récurrence")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textTertiary)

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
                            .padding(.vertical, DesignTokens.Spacing.sm + 2)
                            .frame(maxWidth: .infinity)
                            .background(recurrence == type ? Color.pulpePrimary : Color.surfaceSecondary)
                            .foregroundStyle(recurrence == type ? Color.textOnPrimary : Color.textPrimary)
                            .clipShape(Capsule())
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
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(Color.textOnPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.pulpePrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                .opacity(canSubmit ? 1 : 0.4)
        }
        .disabled(!canSubmit)
        .buttonStyle(.plain)
    }

    // MARK: - Logic

    private func parseAmount(_ text: String) {
        if let value = text.parsedAsAmount {
            amount = value
        } else {
            amount = nil
        }
    }

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
            onUpdate(updatedLine)
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
}
