import SwiftUI

/// PUL-17 — one occurrence row in the "Dépense lissée" timeline.
///
/// Month label + amount, OR — when the month has real sub-transactions
/// (`transactionCount > 0`) — the realized composite "consommé / prévu barré"
/// (the plan was replaced by the real spend; one shared currency symbol). Past
/// (vs the VIEWED month) = dimmed + non-interactive; checked = full-row
/// strike-through; the viewed-period row carries a "Ce mois" / "Ici" marker.
/// All amounts are 2-decimal (`asAmount`/`asCurrency`) per the budget-detail rule.
struct SpreadOccurrenceRow: View {
    let item: SpreadOccurrenceItem
    let currency: SupportedCurrency
    /// `true` when the viewed budget IS the live current period → "Ce mois";
    /// otherwise the marked row is just the viewed month → "Ici".
    let isCurrentPeriod: Bool

    private var occurrence: SpreadOccurrence { item.occurrence }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthLabel)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(item.isChecked ? Color.secondary : Color.textPrimary)
                    .strikethrough(item.isChecked, color: .secondary)

                if item.isCurrent {
                    Text(isCurrentPeriod ? "Ce mois" : "Ici")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.pulpePrimary)
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            amountView
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .opacity(item.isPast ? DesignTokens.Opacity.disabled : 1)
        .allowsHitTesting(!item.isPast)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    @ViewBuilder
    private var amountView: some View {
        if occurrence.transactionCount > 0 {
            // Réalisé : consommé en avant, prévu barré, un seul symbole. Les deux
            // nombres en 2 décimales (ligne) — un prévu 24.99 ne doit jamais
            // s'afficher barré "25" à côté d'un réalisé 24.99.
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
                Text(occurrence.consumed.asAmount(for: currency))
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(Color.textPrimary)
                Text("/")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                Text(occurrence.amount.asAmount(for: currency))
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                    .strikethrough(true, color: Color.textTertiary)
                Text(currency.symbol)
                    .font(PulpeTypography.amountCard)
                    .foregroundStyle(Color.textPrimary)
            }
            .monospacedDigit()
            .sensitiveAmount()
        } else {
            Text(occurrence.amount.asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .foregroundStyle(item.isChecked ? Color.secondary : Color.textPrimary)
                .strikethrough(item.isChecked, color: .secondary)
                .sensitiveAmount()
        }
    }

    private var monthLabel: String {
        "\(Formatters.monthName(for: occurrence.month)) \(occurrence.year)"
    }

    private var accessibilityLabel: String {
        var parts = [monthLabel]
        if occurrence.transactionCount > 0 {
            parts.append(
                "\(occurrence.consumed.asCurrency(currency)) consommés sur "
                    + "\(occurrence.amount.asCurrency(currency)) prévus"
            )
        } else {
            parts.append(occurrence.amount.asCurrency(currency))
        }
        if item.isCurrent { parts.append(isCurrentPeriod ? "ce mois" : "ici") }
        if item.isChecked { parts.append("pointé") }
        if item.isPast { parts.append("passé") }
        return parts.joined(separator: ", ")
    }
}
