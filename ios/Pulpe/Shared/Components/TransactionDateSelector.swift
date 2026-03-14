import SwiftUI

/// Reusable date picker row for transaction forms.
struct TransactionDateSelector: View {
    @Binding var date: Date

    var body: some View {
        HStack {
            Label("Date", systemImage: "calendar")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            DatePicker("", selection: $date, displayedComponents: .date)
                .labelsHidden()
                .datePickerStyle(.compact)
                .accessibilityLabel("Date de la transaction")
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }
}
