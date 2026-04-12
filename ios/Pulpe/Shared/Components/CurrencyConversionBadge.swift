import SwiftUI

/// Badge showing currency conversion metadata as a popover.
/// Renders nothing when conversion metadata is absent OR when the
/// multi-currency feature flag is disabled (kill switch honored).
struct CurrencyConversionBadge: View {
    let originalAmount: Decimal?
    let originalCurrency: SupportedCurrency?
    let exchangeRate: Decimal?

    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @State private var isShowingPopover = false

    private var hasConversion: Bool {
        featureFlagsStore.isMultiCurrencyEnabled
            && originalAmount != nil
            && originalCurrency != nil
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
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityLabel("Détails de conversion")
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
            originalCurrency: .eur,
            exchangeRate: 0.9412
        )
    }
    .environment(FeatureFlagsStore())
}

#Preview("No conversion") {
    CurrencyConversionBadge(
        originalAmount: nil,
        originalCurrency: nil,
        exchangeRate: nil
    )
    .environment(FeatureFlagsStore())
}
