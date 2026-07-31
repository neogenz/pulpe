import SwiftUI

/// Tour 11 "Ça dérive" — envelopes consumed beyond plan this month, with mini
/// planned/overflow bars, and a "Rattraper" footer action listing the real levers.
/// Only rendered when the current month actually drifts.
struct DriftCard: View {
    let drifts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    let totalOver: Decimal
    var tagNamesById: [String: String] = [:]
    /// Next-month name for the "ajuster {mois}" lever in the footer subtitle.
    let adjustMonthName: String
    var onCatchUp: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden

    /// Matches `ActivityCard.maxRows` and the store's dashboard cap — a month that drifts on
    /// ten envelopes shouldn't render a card ten mini-bars tall, which is precisely the month
    /// the screen most needs to stay calm.
    private static let maxRows = 3

    private var currency: SupportedCurrency { userSettingsStore.currency }

    /// Residual count when more envelopes drift than the card shows.
    private var overflowLabel: String {
        let hidden = drifts.count - Self.maxRows
        return "+\(hidden) autre\(hidden > 1 ? "s" : "") enveloppe\(hidden > 1 ? "s" : "")"
    }

    private var catchUpAccessibilityLabel: String {
        guard !amountsHidden else { return "Rattraper le dépassement" }
        return "Rattraper ces \(totalOver.asCompactCurrency(currency)) en trop"
    }

    private func rowAccessibilityLabel(_ line: BudgetLine, overBy: Decimal) -> String {
        let names = TagChips.names(for: line.tagIds, namesById: tagNamesById)
        let tags = names.isEmpty ? "" : ", tags : \(names.joined(separator: ", "))"
        guard !amountsHidden else { return "\(line.name), au-delà du plan\(tags)" }
        return "\(line.name), \(overBy.asCompactCurrency(currency)) au-delà du plan\(tags)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // No link on this heading: the card ends on "Rattraper", which goes to the
            // same place and names the remedy. Two ways into the budget, one of them
            // unnamed, is the arrangement this screen is getting rid of.
            HomeSectionHeader(
                title: "Ça dérive",
                amountSubtitle: "\(totalOver.asCompactCurrency(currency)) au-delà du plan"
            )

            VStack(spacing: DesignTokens.Spacing.none) {
                ForEach(
                    Array(drifts.prefix(Self.maxRows).enumerated()),
                    id: \.element.line.id
                ) { index, drift in
                    if index > 0 { Divider() }
                    driftRow(drift.line, drift.consumption)
                }

                if drifts.count > Self.maxRows {
                    Divider()
                    Text(overflowLabel)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, DesignTokens.Spacing.md)
                }

                Divider()

                Button(action: onCatchUp) {
                    catchUpRow
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .plainPressedButtonStyle()
                .accessibilityLabel(catchUpAccessibilityLabel)
                // Names the destination, not three levers the destination doesn't offer.
                .accessibilityHint("Ouvre le budget pour ajuster tes enveloppes")
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .pulpeRowCard()
        }
    }

    // MARK: - Drift Row

    private func driftRow(_ line: BudgetLine, _ consumption: BudgetFormulas.Consumption) -> some View {
        let overBy = -consumption.available
        let fill = plannedFraction(line, consumption)
        let tagNames = TagChips.names(for: line.tagIds, namesById: tagNamesById)

        return VStack(spacing: DesignTokens.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(line.name)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)

                if !tagNames.isEmpty {
                    TagChips(names: tagNames, presentation: .count, followsText: true)
                }

                Spacer()

                // Compact 0-décimale: a drift overrun is a derived envelope delta —
                // aggregation category per the currency policy, like the header above it.
                Text("+\(overBy.asCompactAmount(for: currency)) en trop")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.driftAccent)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .sensitiveAmount()
            }

            // The plan is grey, the excess is the only colored thing on the bar: what
            // the row reports is the overrun, and full-strength ink on the planned
            // share made two heavy segments compete to say it.
            HomeSegmentedBar(
                fillFraction: fill,
                overflowFraction: 1 - fill,
                fillColor: .textSecondary,
                overflowColor: .driftAccent,
                trackColor: .progressTrack,
                height: DesignTokens.ProgressBar.thickHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(line, overBy: overBy))
    }

    /// Planned share of the consumed bar: `amount / allocated`.
    private func plannedFraction(_ line: BudgetLine, _ consumption: BudgetFormulas.Consumption) -> Double {
        guard consumption.allocated > 0, line.amount > 0 else { return 0 }
        return min(Double(truncating: (line.amount / consumption.allocated) as NSDecimalNumber), 1)
    }

    // MARK: - Catch-Up Footer

    private var catchUpRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Rattraper ces \(totalOver.asCompactAmount(for: currency)) en trop")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .monospacedDigit()
                    .sensitiveAmount()

                Text("Alléger le prévu du mois · piocher dans l'épargne · ajuster \(adjustMonthName)")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.pulpePrimary.opacity(DesignTokens.Opacity.heavy))
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}
