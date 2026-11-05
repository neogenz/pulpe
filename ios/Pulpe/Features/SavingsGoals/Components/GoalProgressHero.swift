import SwiftUI

/// V2 hero card of the goal detail: what is saved in ink, the cible under it, the bar
/// with its two labels, and in the ordinary state two grey tiles and one sentence.
/// Every conditional line is decided in `GoalHeroPresentation`.
struct GoalProgressHero: View {
    let presentation: GoalHeroPresentation
    let currency: SupportedCurrency

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            figure
            if let bar = presentation.bar {
                progressBar(bar)
            }
            if !presentation.tiles.isEmpty {
                HeroMetricTileRow {
                    ForEach(presentation.tiles, id: \.identifier) { tile in
                        GoalHeroTile(label: tile.label, value: tile.value)
                            .accessibilityIdentifier(tile.identifier)
                    }
                }
            }
            if let sentence = presentation.sentence {
                Text(sentence)
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()
                    .accessibilityIdentifier("savingsGoalRequiredPaceStat")
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        // `.contain` scopes the identifier to the card; bare, it would propagate onto
        // every descendant and clobber their own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalProgressCard")
    }

    private var figure: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Épargné")
                .font(PulpeTypography.labelMedium.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
            (Text(verbatim: presentation.confirmedAmount.asAmount(for: currency))
                .font(PulpeTypography.heroAmount)
                .tracking(DesignTokens.Tracking.hero)
                + Text(verbatim: " \(currency.symbol)")
                .font(PulpeTypography.heroCurrencySuffix)
                .foregroundStyle(Color.textTertiary))
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .lineLimit(1)
                .contentTransition(.numericText())
            if let caption = presentation.caption {
                Text(caption)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }
        }
        .sensitiveAmount()
    }

    private func progressBar(_ bar: GoalHeroPresentation.Bar) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            GoalProgressTrack(fraction: bar.fraction, isMuted: bar.isMuted)
                .frame(height: DesignTokens.ProgressBar.thickHeight)
            HStack {
                Text(bar.percent)
                    .font(PulpeTypography.labelMedium.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                if let trailing = bar.trailing {
                    Text(trailing)
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
            }
            .monospacedDigit()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([bar.accessibilityLabel, bar.trailing].compactMap(\.self).joined(separator: ", "))
        .accessibilityIdentifier("savingsGoalTargetProgressBar")
    }
}

/// The V2 goal bar: a sunk track under a green fill, grey once the goal is paused.
/// Shared by the hero card and the goals list rows.
struct GoalProgressTrack: View {
    let fraction: Double
    var isMuted = false

    var body: some View {
        ZStack(alignment: .leading) {
            ProgressBarShape(progress: 1).fill(Color.sunk)
            ProgressBarShape(progress: CGFloat(min(max(fraction, 0), 1)))
                .fill(isMuted ? Color.textTertiary : Color.pulpePrimary)
                .animation(DesignTokens.Animation.gentleSpring, value: fraction)
        }
        .accessibilityHidden(true)
    }
}

/// A grey tile of the goal card: label over its value (« Requis par mois », « Échéance »).
struct GoalHeroTile: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
            Text(value)
                .font(PulpeTypography.totalAmount)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .sensitiveAmount()
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
        .accessibilityElement(children: .combine)
    }
}
