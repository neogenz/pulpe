import SwiftUI

/// Reusable date picker row for transaction forms.
struct TransactionDateSelector: View {
    @Binding var date: Date
    /// Drives the picker's date format via locale — follows the user's currency
    /// (CHF → fr_CH dd.MM.yyyy, EUR → fr_FR dd/MM/yyyy), not the device region.
    let currency: SupportedCurrency
    /// `.standalone` draws its own soft background; `.row` is a bare line for a `FormCard`.
    var style: FormRowStyle = .standalone

    var body: some View {
        switch style {
        case .standalone:
            row
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        case .row:
            row
                .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
    }

    private var row: some View {
        HStack {
            Label("Date", systemImage: "calendar")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            DatePicker("", selection: $date, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .environment(\.locale, Formatters.locale(for: currency))
                .accessibilityLabel("Date")
        }
    }
}

/// How a form atom dresses itself: on its own (soft background) or as one row of a `FormCard`.
enum FormRowStyle {
    case standalone
    case row
}
