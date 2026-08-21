import SwiftUI

/// A metric on the hero: value over its label on a translucent `heroTile`. Never a chip.
/// A `tint` colors the value when an accent applies; the label always stays secondary ink.
struct HeroMetricTile: View {
    var icon: String?
    let label: String
    let value: String
    var tint: Color = .heroInk
    var showsChevron = false

    var body: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.sm) {
            if let icon {
                Image(systemName: icon)
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.heroInkSecondary)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(value)
                    .font(PulpeTypography.labelLarge.weight(.semibold))
                    .foregroundStyle(tint)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(DesignTokens.TextScale.compact)
                    .sensitiveAmount()
                Text(label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.heroInkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: DesignTokens.Spacing.none)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.heroInkSecondary)
                    .accessibilityHidden(true)
            }
        }
        .padding(DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.heroTile, in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))
        .accessibilityElement(children: .combine)
    }
}

/// Lays tiles side by side, and stacks them once accessibility text sizes no longer fit.
struct HeroMetricTileRow<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) { content() }
            VStack(spacing: DesignTokens.Spacing.sm) { content() }
        }
    }
}
