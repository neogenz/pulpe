import SwiftUI

/// Reusable date picker row for transaction forms.
struct TransactionDateSelector: View {
    @Binding var date: Date
    /// Drives the picker's date format via locale — follows the user's currency
    /// (CHF → fr_CH dd.MM.yyyy, EUR → fr_FR dd/MM/yyyy), not the device region.
    let currency: SupportedCurrency

    var body: some View {
        HStack {
            Label("Date", systemImage: "calendar")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            DatePicker("", selection: $date, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .environment(\.locale, Formatters.locale(for: currency))
                .accessibilityLabel("Date de la transaction")
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }
}
