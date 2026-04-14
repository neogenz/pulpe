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
                HStack(spacing: DesignTokens.Spacing.xs) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(PulpeTypography.caption2)
                    if let amount = originalAmount, let currency = originalCurrency {
                        Text("converti depuis \(amount.asCurrency(currency))")
                            .font(PulpeTypography.caption)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.sm)
                .padding(.vertical, DesignTokens.Spacing.xxs)
                .background(Color.surfaceContainerHigh)
                .foregroundStyle(Color.onSurfaceVariant)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityLabel(originalAmount.map { amount in
                originalCurrency.map { currency in
                    "Détails de conversion, converti depuis \(amount.asCurrency(currency))"
                } ?? "Détails de conversion"
            } ?? "Détails de conversion")
            .popover(isPresented: $isShowingPopover) {
                popoverContent
                    .presentationCompactAdaptation(.popover)
            }
        }
    }

    private var popoverContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let amount = originalAmount, let currency = originalCurrency {
                Text("Tu as entré")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                Text(amount.asCurrency(currency))
                    .font(PulpeTypography.bodyLarge.weight(.semibold))
            }
            if let rate = exchangeRate, let originalCurrency {
                Divider()
                    .padding(.vertical, DesignTokens.Spacing.xxs)
                let formattedRate = rate.formatted(
                    .number.precision(.fractionLength(2...4))
                )
                Text("Taux figé : 1 \(originalCurrency.rawValue) = \(formattedRate)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                Text("On ne le recalcule plus, même si le taux bouge.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: 280)
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
