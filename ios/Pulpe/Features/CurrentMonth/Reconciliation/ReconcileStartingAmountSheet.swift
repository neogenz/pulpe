import SwiftUI

/// « Argent d'avant Pulpe »: corrects the money from before Pulpe, or resets it. Answers once through
/// `onAnswer` with the amount to store; closing it answers nothing.
struct ReconcileStartingAmountSheet: View {
    let currency: SupportedCurrency
    let onAnswer: (Decimal) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text: String
    @FocusState private var focus: AmountDescriptionField?

    init(amount: Decimal, currency: SupportedCurrency, onAnswer: @escaping (Decimal) -> Void) {
        self.currency = currency
        self.onAnswer = onAnswer
        _text = State(initialValue: amount.formatted(
            .number.grouping(.never).precision(.fractionLength(2)).locale(Formatters.locale(for: currency))
        ))
    }

    /// Blank or unreadable: nothing to save.
    private var amount: Decimal? {
        guard case .valid(let cents) = AccountReconciliation.parseAmount(text) else { return nil }
        return AccountReconciliation.amount(cents: cents)
    }

    private var isInvalid: Bool { !text.isEmpty && amount == nil }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Argent d'avant Pulpe"), isLoading: false, focus: $focus, focusOrder: [.amount]
        ) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                amountField
                // The step-1 row's words: a red border alone does not say what to fix.
                if isInvalid {
                    Text("Chiffres et 2 décimales au plus")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.errorPrimary)
                }
            }
            VStack(spacing: DesignTokens.Spacing.sm) {
                Button(AppLocale.string("Enregistrer")) { if let amount { answer(amount) } }
                    .disabled(amount == nil)
                    .primaryButtonStyle(isEnabled: amount != nil)
                    .accessibilityIdentifier("reconcileStartingSaveButton")
                Button(AppLocale.string("Remettre à 0")) { answer(0) }
                    .tertiaryButtonStyle()
                    .accessibilityIdentifier("reconcileStartingResetButton")
            }
        }
    }

    /// A plain field, not `HeroAmountField`: that one drops a minus, and a −500 typed on the web must
    /// never come back as +500.
    private var amountField: some View {
        let isFocused = focus == .amount
        return HStack(spacing: DesignTokens.Spacing.sm) {
            Text(verbatim: currency.symbol)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            TextField(Decimal.zero.asAmount(for: currency), text: $text)
                .keyboardType(.decimalPad)
                .lineLimit(1)
                .focused($focus, equals: .amount)
                .accessibilityLabel(AppLocale.string("Montant"))
                .accessibilityIdentifier("reconcileStartingAmountField")
                // The value only, as the web: the field and its symbol stay readable.
                .sensitiveAmount()
        }
        .font(PulpeTypography.impactAmount)
        .monospacedDigit()
        .foregroundStyle(Color.textPrimary)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .background(Color.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.input))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.input)
                .strokeBorder(
                    isInvalid ? Color.errorPrimary : isFocused ? Color.pulpePrimary : Color.outline,
                    lineWidth: isFocused || isInvalid
                        ? DesignTokens.Control.inputFocusBorder
                        : DesignTokens.BorderWidth.thin
                )
        }
        .contentShape(.interaction, Rectangle())
        .onTapGesture { focus = .amount }
        .id(AmountDescriptionField.amount)
    }

    private func answer(_ amount: Decimal) {
        onAnswer(amount)
        dismiss()
    }
}
