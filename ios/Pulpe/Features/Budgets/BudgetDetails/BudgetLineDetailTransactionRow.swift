import SwiftUI

/// Compact row designed for the budget line detail page (DM2.1.c spec).
/// Differs from `TransactionRow`: no kind icon circle (the parent envelope already
/// communicates the kind), inline FX caption directly under the amount.
struct BudgetLineDetailTransactionRow: View {
    let transaction: Transaction
    let displayCurrency: SupportedCurrency
    let tagNames: [String]
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(transaction.name)
                        .font(PulpeTypography.labelLargeBold)
                        .foregroundStyle(transaction.isChecked ? .secondary : .primary)
                        .strikethrough(transaction.isChecked, color: .secondary)
                        .lineLimit(1)

                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Text(transaction.transactionDate.relativeFormatted)
                            .font(PulpeTypography.metricMini)
                            .foregroundStyle(Color.textTertiary)

                        if !tagNames.isEmpty {
                            TagChips(names: tagNames, presentation: .count, followsText: true)
                        }
                    }
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                amountColumn
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Touche pour modifier")
    }

    /// Mirrors `BudgetLineMixedRow.accessibilityLabel`. The synthesized label
    /// SwiftUI builds from the subviews carries the name, the date and the
    /// amount but nothing about the pointed state — that only exists visually,
    /// as a strikethrough. Pointing is the whole signal on this screen, so the
    /// row has to say it out loud.
    private var accessibilityLabel: String {
        let status = transaction.isChecked ? AppLocale.string("Pointé") : AppLocale.string("À pointer")
        let amount = transaction.amount.asCurrency(displayCurrency)
        let tags = tagNames.isEmpty
            ? ""
            : " · " + AppLocale.string("Tags : \(tagNames.joined(separator: ", "))")
        return "\(transaction.name) · \(transaction.transactionDate.relativeFormatted) · \(amount) · \(status)\(tags)"
    }

    private var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.amount.asAmount(for: displayCurrency))
                    .font(PulpeTypography.labelLargeBold)
                    .foregroundStyle(transaction.isChecked ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                    .monospacedDigit()

                Text(displayCurrency.symbol)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }

            if let secondary = TransactionAmountView.secondaryText(for: transaction, in: displayCurrency) {
                Text(secondary)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .accessibilityLabel("saisi en \(secondary)")
            }
        }
        .sensitiveAmount()
    }
}
