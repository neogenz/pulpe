import SwiftUI

/// « Je propose … » under an asset row: the value the checked prévisions justify, applied or
/// dismissed. The proposed value is the API's, never recomputed.
struct NetWorthSuggestionRow: View {
    let asset: Asset
    let suggestion: AssetSuggestion
    let apply: () -> Void
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(AppLocale.string("Je propose \(suggestion.proposedValue.asCurrency(asset.currency))"))
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
            Text(detail)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()
            HStack(spacing: DesignTokens.Spacing.sm) {
                Button(AppLocale.string("Écarter"), action: dismiss)
                    .secondaryButtonStyle(size: .small)
                    .accessibilityIdentifier("netWorthSuggestionDismiss")
                Button(AppLocale.string("Appliquer"), action: apply)
                    .primaryButtonStyle(size: .small)
                    .accessibilityIdentifier("netWorthSuggestionApply")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, DesignTokens.Spacing.md)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("netWorthSuggestion")
    }

    private var detail: String {
        let amount = asset.suggestionMagnitude.asCurrency(asset.currency)
        switch asset.suggestionDetail {
        case .saved: return AppLocale.string("\(amount) d'épargne pointée depuis la dernière valeur")
        case .drawn: return AppLocale.string("\(amount) de revenu tiré depuis la dernière valeur")
        case .repaid: return AppLocale.string("\(amount) de remboursement pointé depuis la dernière valeur")
        }
    }
}
