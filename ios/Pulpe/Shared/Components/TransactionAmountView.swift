import SwiftUI

/// Trailing amount column for transaction rows.
///
/// Renders the signed primary amount in the row's display currency and, when the
/// transaction was captured in a different currency, a caption-sized secondary
/// line showing the original amount (e.g. `1 234,56 €`).
///
/// Secondary visibility is driven purely by the presence of conversion metadata
/// — it's not gated behind the multi-currency feature flag. Once a transaction
/// has been captured in EUR, switching the flag off shouldn't rewrite its
/// history in the UI.
///
/// Both lines are blurred together when amounts are hidden via
/// `.sensitiveAmount()`. The secondary line carries a contextual VoiceOver label
/// ("saisi en …") so parents relying on children-combined accessibility get the
/// conversion info automatically. Parents that build their own explicit
/// `accessibilityLabel` can reuse `accessibilityAmountSuffix(for:in:)` to stay
/// consistent.
struct TransactionAmountView: View {
    let transaction: Transaction
    let displayCurrency: SupportedCurrency

    /// Pure helper exposed for unit testing the secondary-text policy.
    /// Returns the original-currency caption string, or `nil` when no secondary
    /// line should be shown.
    static func secondaryText(
        for transaction: Transaction,
        in displayCurrency: SupportedCurrency
    ) -> String? {
        guard
            let originalAmount = transaction.originalAmount,
            let originalCurrency = transaction.originalCurrency,
            originalCurrency != displayCurrency
        else {
            return nil
        }
        return originalAmount.asCurrency(originalCurrency)
    }

    /// VoiceOver suffix ("saisi en 100,00 €") to append to a row's amount label
    /// when the transaction was captured in a different currency. Returns an
    /// empty string otherwise — safe to concatenate unconditionally.
    static func accessibilityAmountSuffix(
        for transaction: Transaction,
        in displayCurrency: SupportedCurrency
    ) -> String {
        guard let secondary = secondaryText(for: transaction, in: displayCurrency) else {
            return ""
        }
        return ", saisi en \(secondary)"
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            Text(transaction.amount.asSignedAmount(for: transaction.kind, in: displayCurrency))
                .font(PulpeTypography.listRowSubtitle)
                .foregroundStyle(transaction.kind.color)

            if let secondary = Self.secondaryText(for: transaction, in: displayCurrency) {
                Text(secondary)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityLabel("saisi en \(secondary)")
            }
        }
        .sensitiveAmount()
    }
}

// MARK: - Preview

#Preview("TransactionAmountView") {
    VStack(alignment: .trailing, spacing: DesignTokens.Spacing.lg) {
        // No conversion — CHF transaction displayed in CHF
        TransactionAmountView(
            transaction: Transaction(
                id: "1",
                budgetId: "b1",
                budgetLineId: nil,
                name: "Migros",
                amount: 45.20,
                kind: .expense,
                transactionDate: Date(),
                category: nil,
                checkedAt: nil,
                createdAt: Date(),
                updatedAt: Date()
            ),
            displayCurrency: .chf
        )

        // Converted from EUR — CHF row showing secondary EUR line
        TransactionAmountView(
            transaction: Transaction(
                id: "2",
                budgetId: "b1",
                budgetLineId: nil,
                name: "Amazon",
                amount: 94.12,
                kind: .expense,
                transactionDate: Date(),
                category: nil,
                checkedAt: nil,
                createdAt: Date(),
                updatedAt: Date(),
                originalAmount: 100,
                originalCurrency: .eur,
                targetCurrency: .chf,
                exchangeRate: 0.9412
            ),
            displayCurrency: .chf
        )
    }
    .padding()
    .pulpeBackground()
}
