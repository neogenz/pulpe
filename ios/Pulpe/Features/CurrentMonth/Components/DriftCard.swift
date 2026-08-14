import SwiftUI

/// Tour 11 "Ça dérive" — envelopes consumed beyond plan this month, with mini
/// magnitude bars sized against the worst overrun on the card, and a "Rattraper"
/// footer action that opens the budget. Only rendered when the current month
/// actually drifts.
struct DriftCard: View {
    let drifts: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]
    let totalOver: Decimal
    var tagNamesById: [String: String] = [:]
    /// Same verdict `HomeHeroCard` renders — reconciles this card's subtitle with the
    /// hero instead of asserting the opposite when the month covered the excess overall.
    let overrunIsAbsorbed: Bool
    var onCatchUp: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden

    /// Fixed rather than derived: this card is a dashboard summary, not a full list, and a
    /// month that drifts on ten envelopes shouldn't render ten mini-bars tall — precisely
    /// the month the dashboard most needs to stay calm.
    private static let maxRows = 3

    private var currency: SupportedCurrency { userSettingsStore.currency }

    /// Local overrun read against the hero's own verdict: a month that stayed at or above
    /// its plan says the excess is absorbed elsewhere instead of asserting the hero's
    /// opposite — a month exactly on plan covered it as surely as one that came out ahead.
    private var subtitle: String {
        let base = "\(totalOver.asCompactCurrency(currency)) au-delà du plan"
        guard overrunIsAbsorbed else { return base }
        return "\(base), compensé ailleurs ce mois"
    }

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
                amountSubtitle: subtitle
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
        .accessibilityIdentifier("homeDriftCard")
    }

    // MARK: - Drift Row

    /// Largest overrun among the rows this card actually renders — the bar's denominator,
    /// so a row's length compares its francs to the worst one on the card instead of
    /// shrinking against its own envelope size.
    private var maxOver: Decimal {
        drifts.prefix(Self.maxRows).map { -$0.consumption.available }.max() ?? 0
    }

    private func driftRow(_ line: BudgetLine, _ consumption: BudgetFormulas.Consumption) -> some View {
        let overBy = -consumption.available
        let fraction = maxOver > 0
            ? min(Double(truncating: (overBy / maxOver) as NSDecimalNumber), 1)
            : 0
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

            // Length encodes the overrun itself, against the worst row on the card — not
            // the envelope's own size, which shrank the biggest loss into the smallest bar.
            // The row already spells out "+100 en trop" in full, so a second grey segment
            // for the planned share only competed with the number for attention.
            HomeSegmentedBar(
                segments: [.init(fraction: fraction, color: .driftAccent)],
                trackColor: .progressTrack,
                height: DesignTokens.ProgressBar.thickHeight
            )
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(rowAccessibilityLabel(line, overBy: overBy))
    }

    // MARK: - Catch-Up Footer

    private var catchUpRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("Rattraper ces \(totalOver.asCompactCurrency(currency)) en trop")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.pulpePrimary)
                    .monospacedDigit()
                    .sensitiveAmount()

                // Names the one thing the tap actually opens — matches `accessibilityHint`.
                Text("Ouvre le budget pour ajuster tes enveloppes")
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
