import SwiftUI

/// Flat hero of the goal detail screen: what is saved, against what, and where
/// the plan leads. No surface of its own — the Hero Flat Rule (`ios/DESIGN.md`)
/// keeps the amount in `textPrimary` on the bare canvas and lets the bar carry
/// the only colour. Every conditional line is decided in `GoalHeroPresentation`.
struct GoalProgressHero: View {
    let presentation: GoalHeroPresentation
    let status: SavingsGoalStatus

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            identity
            if let bar = presentation.bar {
                layeredBar(bar)
            }
            sentences
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // `.contain` scopes the identifier to the hero node; bare, it would
        // propagate onto every descendant and clobber their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalProgressCard")
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text("Épargné")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)

                Spacer(minLength: DesignTokens.Spacing.sm)

                if presentation.showsStatusChip {
                    SavingsGoalStatusBadge(status: status)
                }
            }

            Text(presentation.amount)
                .font(PulpeTypography.amountHero)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()

            meta

            if let initialAmountLine = presentation.initialAmountLine {
                Text(initialAmountLine)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textTertiary)
                    .sensitiveAmount()
            }
        }
    }

    /// Target and dates as two fragments rather than one composed sentence: the
    /// date keeps the identifier that tells which variant a goal renders, and
    /// each fragment stays a standalone catalog key.
    private var meta: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
            if let targetLine = presentation.targetLine {
                Text(targetLine)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
            if let dateLine = presentation.dateLine {
                if presentation.targetLine != nil {
                    Text(verbatim: "·")
                }
                Text(dateLine.text)
                    .ifLet(dateLine.identifier) { view, id in view.accessibilityIdentifier(id) }
            }
            Spacer(minLength: 0)
        }
        .font(PulpeTypography.labelMedium)
        .foregroundStyle(Color.textSecondary)
    }

    @ViewBuilder
    private var sentences: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let verdict = presentation.verdict {
                Text(verdict)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityIdentifier("savingsGoalPaceIndicator")
            } else if let dayOneBeat = presentation.dayOneBeat {
                Text(dayOneBeat)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }

            if let projection = presentation.projection {
                secondaryLine(projection, identifier: "savingsGoalProjectionStat")
            }
            if let requiredPace = presentation.requiredPace {
                secondaryLine(requiredPace, identifier: "savingsGoalRequiredPaceStat")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func secondaryLine(_ copy: String, identifier: String) -> some View {
        Text(copy)
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.textSecondary)
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .sensitiveAmount()
            .accessibilityIdentifier(identifier)
    }

    private func layeredBar(_ bar: GoalHeroPresentation.Bar) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ZStack(alignment: .leading) {
                ProgressBarShape(progress: 1)
                    .fill(Color.progressTrack)

                ProgressBarShape(progress: CGFloat(bar.projected))
                    .fill(Color.financialSavings.opacity(DesignTokens.Opacity.strong))

                ProgressBarShape(progress: CGFloat(bar.confirmed))
                    .fill(Color.financialSavings)
                    .animation(DesignTokens.Animation.gentleSpring, value: bar.confirmed)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            Text(bar.percent)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(bar.accessibilityLabel)
        .accessibilityIdentifier("savingsGoalTargetProgressBar")
    }
}
