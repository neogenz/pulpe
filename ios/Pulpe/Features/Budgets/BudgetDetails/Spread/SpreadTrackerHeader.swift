import SwiftUI

/// PUL-17 — progress tracker header for the "Dépense lissée" sheet: a position
/// line, the realized cumulé/total, a `pulpePrimary` bar filled to
/// `progressPercent`, and (PUL-290) the explicit catch-up that replaces the
/// static "T/N par mois" line the user used to compute by hand.
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

            provisionLine
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    /// PUL-290 — three serene states: objectif atteint (nothing left), the
    /// rattrapage (reste + à prévoir par mois), or the final gap (every month
    /// closed yet under-provisioned — no actionable month, no division by zero).
    @ViewBuilder
    private var provisionLine: some View {
        if tracker.remainingToProvision <= 0 {
            Text("Objectif atteint")
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.pulpePrimary)
        } else if let perRemaining = tracker.perRemainingMonth {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(remainingLabel)
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                    .monospacedDigit()
                    .sensitiveAmount()
                Text(perRemainingMonthLabel(perRemaining))
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
        } else {
            Text(finalGapLabel)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
                .monospacedDigit()
                .sensitiveAmount()
        }
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

    private var remainingLabel: String {
        "Reste \(tracker.remainingToProvision.asCurrency(currency)) à provisionner"
    }

    private func perRemainingMonthLabel(_ amount: Decimal) -> String {
        "Prévois ~\(amount.asCurrency(currency)) par mois pour tenir l'objectif"
    }

    private var finalGapLabel: String {
        "Tous les mois sont clôturés · il reste "
            + "\(tracker.remainingToProvision.asCurrency(currency)) non provisionné"
    }

    private var provisionLabel: String {
        if tracker.remainingToProvision <= 0 {
            return "Objectif atteint"
        }
        if let perRemaining = tracker.perRemainingMonth {
            return "\(remainingLabel), \(perRemainingMonthLabel(perRemaining))"
        }
        return finalGapLabel
    }

    private var accessibilityLabel: String {
        "\(positionLabel), \(cumulatedLabel), \(provisionLabel)"
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
            progressPercent: 33.3,
            remainingToProvision: 400,
            perRemainingMonth: 100
        ),
        currency: .chf
    )
    .padding()
    .frame(maxWidth: .infinity)
    .background(Color.appBackground)
}
