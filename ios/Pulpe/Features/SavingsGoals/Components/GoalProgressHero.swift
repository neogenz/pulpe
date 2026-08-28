import SwiftUI

/// Hero of the goal detail screen on the shared forest surface (ios/DESIGN.md, One Hero):
/// what is saved against the target, the layered confirmed / projected bar, the tiles
/// the plan earns and one verdict. Every conditional line is decided in
/// `GoalHeroPresentation`.
struct GoalProgressHero: View {
    let presentation: GoalHeroPresentation
    let status: SavingsGoalStatus

    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            identity
            if let bar = presentation.bar {
                layeredBar(bar)
            }
            if !presentation.tiles.isEmpty {
                HeroMetricTileRow {
                    ForEach(presentation.tiles, id: \.identifier) { tile in
                        HeroMetricTile(label: tile.label, value: tile.value)
                            .accessibilityIdentifier(tile.identifier)
                    }
                }
            }
            sentences
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // `.contain` scopes the identifier to the hero node; bare, it would
        // propagate onto every descendant and clobber their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalProgressCard")
    }

    private var accent: Color {
        switch presentation.accent {
        case .positive: .heroAccentPositive
        case .caution: .heroAccentCaution
        case .neutral: .heroInk
        }
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
                HeroFigure(
                    eyebrow: AppLocale.string("Épargné"),
                    amount: presentation.confirmedAmount,
                    currency: userSettingsStore.currency,
                    suffix: presentation.targetLine,
                    alignment: .leading
                )
                Spacer(minLength: DesignTokens.Spacing.sm)
                if presentation.showsStatusChip {
                    SavingsGoalStatusBadge(status: status)
                }
            }

            meta

            if let initialAmountLine = presentation.initialAmountLine {
                Text(initialAmountLine)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.heroInkSecondary)
                    .sensitiveAmount()
            }
        }
    }

    /// The date keeps the identifier that tells which variant a goal renders.
    @ViewBuilder
    private var meta: some View {
        if let dateLine = presentation.dateLine {
            Text(dateLine.text)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.heroInkSecondary)
                .ifLet(dateLine.identifier) { view, id in view.accessibilityIdentifier(id) }
        }
    }

    @ViewBuilder
    private var sentences: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if let verdict = presentation.verdict {
                HeroVerdictRow(
                    sentence: verdict,
                    accent: accent,
                    accessibilityIdentifier: "savingsGoalPaceIndicator"
                )
            } else if let dayOneBeat = presentation.dayOneBeat {
                HeroVerdictRow(sentence: dayOneBeat)
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
            .foregroundStyle(Color.heroInkSecondary)
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
                    .fill(Color.heroInk.opacity(DesignTokens.Opacity.heroTile))

                ProgressBarShape(progress: CGFloat(bar.projected))
                    .fill(Color.heroInkSecondary.opacity(DesignTokens.Opacity.heroInkMuted))

                ProgressBarShape(progress: CGFloat(bar.confirmed))
                    .fill(Color.heroInkSecondary)
                    .animation(DesignTokens.Animation.gentleSpring, value: bar.confirmed)
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)

            Text(bar.percent)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.heroInkSecondary)
                .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(bar.accessibilityLabel)
        .accessibilityIdentifier("savingsGoalTargetProgressBar")
    }
}
