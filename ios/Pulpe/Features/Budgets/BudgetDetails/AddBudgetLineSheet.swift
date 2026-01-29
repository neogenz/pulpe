import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""

    private let budgetLineService = BudgetLineService.shared

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    private static let amountFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = "'"
        return formatter
    }()

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Self.amountFormatter.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    heroAmountSection
                    descriptionField
                    kindSelector

                    if let error {
                        ErrorBanner(message: error.localizedDescription) {
                            self.error = nil
                        }
                    }

                    addButton
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.xxxl)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .background(Color.surfacePrimary)
            .navigationTitle("Nouvelle prévision")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .loadingOverlay(isLoading)
            .dismissKeyboardOnTap()
            .task {
                try? await Task.sleep(for: .milliseconds(200))
                isAmountFocused = true
            }
        }
    }

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("CHF")
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
                    .animation(.snappy(duration: 0.2), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            RoundedRectangle(cornerRadius: 1)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(0.3))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: 0.2), value: isAmountFocused)
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
                    withAnimation(.easeInOut(duration: 0.2)) {
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

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            Task { await addBudgetLine() }
        } label: {
            Text("Ajouter")
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
        let cleaned = text
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }

        let components = cleaned.split(separator: ".")
        let sanitized: String
        if components.count > 1 {
            let fractional = String(components.dropFirst().joined().prefix(2))
            sanitized = "\(components[0]).\(fractional)"
        } else {
            sanitized = cleaned
        }

        if let decimal = Decimal(string: sanitized) {
            amount = decimal
        } else if sanitized.isEmpty {
            amount = nil
        }
    }

    private func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        let data = BudgetLineCreate(
            budgetId: budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            recurrence: .oneOff
        )

        do {
            let budgetLine = try await budgetLineService.createBudgetLine(data)
            onAdd(budgetLine)
            dismiss()
        } catch {
            self.error = error
        }
    }
}

#Preview {
    AddBudgetLineSheet(budgetId: "test") { line in
        print("Added: \(line)")
    }
}
