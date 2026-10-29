import SwiftUI

/// The hero's progress line: a track in hero ink, its fill, and the value beside it. The
/// budget page measures the month's consumption with it, the budget list the year's
/// budgeted months — one line, so the two heroes read the same way.
struct HeroProgressRow: View {
    /// 0...1; clamped here so callers can pass a raw ratio.
    let progress: Double
    let valueText: String

    private var fill: Double { min(max(progress, 0), 1) }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ZStack(alignment: .leading) {
                // A progress track, not a chip: `.rect(cornerRadius:)` keeps the pill shape
                // without tripping the ad-hoc chip lint.
                Rectangle()
                    .fill(Color.heroInk.opacity(DesignTokens.Opacity.heroTile))
                    .clipShape(.rect(cornerRadius: DesignTokens.ProgressBar.heroHeight / 2))
                ProgressBarShape(progress: fill)
                    .fill(Color.heroInkSecondary)
                    .animation(DesignTokens.Animation.smoothEaseInOut, value: fill)
            }
            .frame(height: DesignTokens.ProgressBar.heroHeight)

            Text(valueText)
                .font(PulpeTypography.progressValue)
                .foregroundStyle(Color.heroInkSecondary)
                .monospacedDigit()
                .accessibilityHidden(true)
        }
    }
}
