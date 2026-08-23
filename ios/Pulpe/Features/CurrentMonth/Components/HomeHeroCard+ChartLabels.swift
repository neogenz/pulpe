import Charts
import SwiftUI

// MARK: - Chart Labels

extension HomeHeroCard {
    /// The plot's pills, drawn over it from one layout pass rather than as per-mark
    /// annotations: only here are all their anchors known in points at once, so none can
    /// land on today's dot or on another pill.
    func labelOverlay(proxy: ChartProxy) -> some View {
        GeometryReader { geometry in
            if let trajectory, let frame = proxy.plotFrame {
                let rects = labelRects(for: trajectory, proxy: proxy, plot: geometry[frame])
                ForEach(HeroChartLabelLayout.Label.allCases, id: \.self) { label in
                    if let rect = rects[label] {
                        chartLabel(labelText(label, for: trajectory))
                            .onGeometryChange(
                                for: CGSize.self,
                                of: { $0.size },
                                action: { pillSizes[label] = $0 }
                            )
                            .position(x: rect.midX, y: rect.midY)
                            .opacity(labelOpacity * (label == .trend ? settlingOpacity : 1))
                    }
                }
            }
        }
        // The scrub gesture under it keeps the whole plot; VoiceOver reads the chart's label.
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func labelText(
        _ label: HeroChartLabelLayout.Label,
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> String {
        switch label {
        case .today: AppLocale.string("Aujourd’hui")
        case .plan: AppLocale.string("Prévu")
        case .trend: Self.trendLabel(for: trajectory, currency: currency)
        }
    }

    private func labelRects(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        proxy: ChartProxy,
        plot: CGRect
    ) -> [HeroChartLabelLayout.Label: CGRect] {
        func anchor(_ point: BudgetFormulas.BalanceTrajectory.Point?) -> CGPoint? {
            guard let point,
                  let position = proxy.position(for: (point.day, Self.decimalValue(point.balance))) else {
                return nil
            }
            return CGPoint(x: plot.minX + position.x, y: plot.minY + position.y)
        }
        guard let today = anchor(trajectory.real.last) else { return [:] }
        var anchors: [HeroChartLabelLayout.Label: CGPoint] = [.today: today]
        anchors[.plan] = anchor(Self.plan(for: trajectory).last)
        if Self.showsTrendLabel(for: trajectory) {
            anchors[.trend] = anchor(Self.projection(for: trajectory).last)
        }
        // Before a pill is measured it is laid out at a guess; the real size lands a frame
        // later and, the layout being pure, settles there.
        let sizes = anchors.mapValues { _ in CGSize(width: 60, height: 18) }.merging(pillSizes) { $1 }
        let dot = DesignTokens.Spacing.md
        return HeroChartLabelLayout(
            plot: plot,
            dot: CGRect(x: today.x - dot / 2, y: today.y - dot / 2, width: dot, height: dot),
            spacing: DesignTokens.Spacing.xs,
            inset: DesignTokens.Spacing.xxl
        ).resolve(
            anchors: anchors,
            sizes: sizes,
            preferredSide: [
                .today: Self.todayLabelPosition(for: trajectory),
                .plan: Self.planLabelPosition(for: trajectory),
                .trend: Self.trendLabelPosition(for: trajectory),
            ]
        )
    }

    /// A word on the plot sits on a sliver of the surface, so a stroke passing under it
    /// never runs through its letters. The same glass tint as the metric tiles below.
    private func chartLabel(_ text: String) -> some View {
        Text(text)
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.heroInkSecondary)
            .lineLimit(1)
            .padding(.horizontal, DesignTokens.Spacing.xs)
            .padding(.vertical, DesignTokens.Spacing.xxs)
            .background(Color.heroTile, in: Capsule())
    }
}
