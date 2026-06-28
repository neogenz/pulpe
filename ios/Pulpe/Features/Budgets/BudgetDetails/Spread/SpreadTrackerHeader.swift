import SwiftUI

/// PUL-17 — progress tracker header for the "Dépense lissée" sheet: a position
/// line, the realized cumulé/total, a `pulpePrimary` bar filled to
/// `progressPercent`, and the per-month tranche.
///
/// All amounts use `asCurrency` (2 decimals) per
/// `feedback_two_decimals_ios_budget_detail` — the budget-detail surface forbids
/// `asCompactCurrency`, so this intentionally diverges from the web 0-decimal
/// aggregation. Mirrors the web `SpreadOccurrencesList` tracker block otherwise.
struct SpreadTrackerHeader: View {
    let tracker: SpreadTracker
    let currency: SupportedCurrency

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(positionLabel)
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textPrimary)

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(cumulatedLabel)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }

            progressBar

            Text("\(tracker.perMonthAmount.asCurrency(currency)) par mois")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var progressBar: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(tracker.progressPercent / 100))
                .fill(Color.pulpePrimary)
        }
        .frame(height: DesignTokens.ProgressBar.thickHeight)
        .accessibilityHidden(true)
    }

    private var positionLabel: String {
        tracker.currentIndex == 0
            ? "Commence le mois prochain"
            : "\(ordinal) mois sur \(tracker.count)"
    }

    private var ordinal: String {
        tracker.currentIndex == 1 ? "1er" : "\(tracker.currentIndex)e"
    }

    private var cumulatedLabel: String {
        "\(tracker.cumulatedAmount.asCurrency(currency)) sur \(tracker.totalAmount.asCurrency(currency))"
    }

    private var accessibilityLabel: String {
        "\(positionLabel), \(cumulatedLabel), \(tracker.perMonthAmount.asCurrency(currency)) par mois"
    }
}

#Preview {
    SpreadTrackerHeader(
        tracker: SpreadTracker(
            count: 6,
            currentIndex: 2,
            cumulatedAmount: 200,
            totalAmount: 600,
            perMonthAmount: 100,
            progressPercent: 33.3
        ),
        currency: .chf
    )
    .padding()
    .frame(maxWidth: .infinity)
    .background(Color.appBackground)
}
