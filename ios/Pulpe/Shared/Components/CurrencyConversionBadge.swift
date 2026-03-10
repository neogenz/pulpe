import SwiftUI

/// Badge showing currency conversion metadata as a popover.
/// Renders nothing when conversion metadata is absent.
struct CurrencyConversionBadge: View {
    let originalAmount: Decimal?
    let originalCurrency: String?
    let exchangeRate: Decimal?

    @State private var isShowingPopover = false

    private var hasConversion: Bool {
        originalAmount != nil && originalCurrency != nil
    }

    var body: some View {
        if hasConversion {
            Button {
                isShowingPopover = true
            } label: {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .popover(isPresented: $isShowingPopover) {
                popoverContent
                    .presentationCompactAdaptation(.popover)
            }
        }
    }

    private var popoverContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let amount = originalAmount, let currency = originalCurrency {
                Text("Converti depuis")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
                Text(amount.asCurrency(currency))
                    .font(PulpeTypography.bodyLarge)
                    .fontWeight(.semibold)
            }
            if let rate = exchangeRate {
                Text("Taux : \(rate.formatted(.number.precision(.fractionLength(2...4))))")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

#Preview("With conversion") {
    HStack {
        Text("CHF 941.20")
        CurrencyConversionBadge(
            originalAmount: 1000,
            originalCurrency: "EUR",
            exchangeRate: 0.9412
        )
    }
}

#Preview("No conversion") {
    CurrencyConversionBadge(
        originalAmount: nil,
        originalCurrency: nil,
        exchangeRate: nil
    )
}
