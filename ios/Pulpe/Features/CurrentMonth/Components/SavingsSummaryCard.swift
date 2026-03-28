import SwiftUI

/// Compact dashboard card showing savings progress for the current month
struct SavingsSummaryCard: View {
    let summary: CurrentMonthStore.SavingsSummary

    @Environment(\.amountsHidden) private var amountsHidden

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            if summary.isComplete {
                completeView
            } else {
                progressView
            }
        }
        .pulpeCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
    }

    // MARK: - Complete State

    private var completeView: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(PulpeTypography.amountXL)
                .foregroundStyle(Color.financialSavings)
                .symbolEffect(.bounce, value: summary.isComplete)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Objectif atteint ce mois")
                    .font(PulpeTypography.listRowTitle)

                Text("\(summary.totalRealized.asCHF) épargnés")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
            }

            Spacer()
        }
    }

    // MARK: - Progress State

    private var progressView: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Amount row
            HStack {
                Text(summary.totalRealized.asCompactCHF)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(Color.financialSavings)
                    .sensitiveAmount()

                Spacer()

                Text("sur \(summary.totalPlanned.asCompactCHF)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.progressTrack)

                    Capsule()
                        .fill(Color.financialSavings)
                        .frame(width: geo.size.width * CGFloat(max(0, min(summary.progressPercentage / 100, 1))))
                        .animation(DesignTokens.Animation.gentleSpring, value: summary.progressPercentage)
                }
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            // Checked count subtitle
            Text("\(summary.checkedCount) sur \(summary.totalCount) pointées")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - Accessibility

    private var accessibilityText: String {
        if summary.isComplete {
            return "Épargne, objectif atteint ce mois"
        }
        return amountsHidden
            ? "Épargne, montant masqué"
            : "Épargne, \(summary.totalRealized.asCHF) réalisé sur \(summary.totalPlanned.asCHF) prévu, "
            + "\(summary.checkedCount) sur \(summary.totalCount) pointées"
    }
}

// MARK: - Preview

#Preview("Savings Summary Card") {
    VStack(spacing: 16) {
        // In progress
        SavingsSummaryCard(
            summary: CurrentMonthStore.SavingsSummary(
                totalPlanned: 1500,
                totalRealized: 900,
                checkedCount: 2,
                totalCount: 3
            )
        )

        // Complete
        SavingsSummaryCard(
            summary: CurrentMonthStore.SavingsSummary(
                totalPlanned: 1000,
                totalRealized: 1000,
                checkedCount: 3,
                totalCount: 3
            )
        )

        // Low progress
        SavingsSummaryCard(
            summary: CurrentMonthStore.SavingsSummary(
                totalPlanned: 2000,
                totalRealized: 200,
                checkedCount: 1,
                totalCount: 5
            )
        )
    }
    .padding()
    .pulpeBackground()
}
