import Charts
import SwiftUI

// MARK: - Monthly Trajectory

extension HomeHeroCard {
    /// The month's landing forecast: it opens on the plan, it arrives on the figure above
    /// it, and it only leaves the horizontal when the month leaves its plan. Everything
    /// drawn here is that one subtraction — the rule it started from, the gap it has opened,
    /// and where the gap leaves it.
    @ViewBuilder
    var balanceChart: some View {
        if let trajectory {
            Chart {
                // The line's own origin, so rule and line can never start apart. It carries
                // its value: a named horizontal with no number is a line the reader has to
                // take on faith, and the gap below is measured from it.
                RuleMark(y: .value("Prévu", Self.decimalValue(trajectory.plannedBalance)))
                    .foregroundStyle(Color.homeHeroSupport)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    // Kept inside the plot: a month below its plan has the rule at the top of
                    // the range and no room above it, and the label went out of the frame
                    // and landed on the metrics row. The side it sits on is empty by
                    // construction — the line never crosses its own rule — so sliding it in
                    // costs nothing.
                    //
                    // Clears the rule by more than the today marker's own radius. On the
                    // first day of a period the marker sits at the left edge, right under
                    // this label, and a tighter gap put the circle through the figure.
                    .annotation(
                        position: Self.ruleLabelPosition(for: trajectory),
                        alignment: .leading,
                        spacing: DesignTokens.Spacing.md,
                        overflowResolution: .init(x: .fit(to: .chart), y: .fit(to: .chart))
                    ) {
                        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
                            Text("Prévu")
                            Text(trajectory.plannedBalance.asCompactCurrency(currency))
                        }
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.homeHeroSupport)
                        .lineLimit(1)
                    }

                ForEach(trajectory.landing) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Atterrissage prévu", Self.decimalValue(point.balance)),
                        series: .value("Série", "Atterrissage")
                    )
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        lineJoin: .round
                    ))
                    .foregroundStyle(accentColor)
                }

                // Nothing is known about the days not yet lived, so the forecast holds its
                // level across them. A slope here would be the plot inventing news.
                ForEach(Self.projection(for: trajectory)) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Estimation finale", Self.decimalValue(point.balance)),
                        series: .value("Série", "Projection")
                    )
                    .interpolationMethod(.linear)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        dash: DesignTokens.Chart.dash
                    ))
                    .foregroundStyle(accentColor.opacity(DesignTokens.Opacity.heroInkMuted))
                }

                // The subtraction, drawn: plan at the top of the stroke, forecast at the
                // bottom of it. Saying "801 de moins" in words asks the reader to hold two
                // numbers; this asks them to look at one distance.
                if let current = trajectory.landing.last, trajectory.drift != 0 {
                    RuleMark(
                        x: .value("Aujourd’hui", current.day),
                        yStart: .value("Prévu", Self.decimalValue(trajectory.plannedBalance)),
                        yEnd: .value("Atterrissage", Self.decimalValue(current.balance))
                    )
                    .foregroundStyle(accentColor.opacity(DesignTokens.Opacity.heroInkMuted))
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                }

                if let current = trajectory.landing.last {
                    PointMark(
                        x: .value("Aujourd’hui", current.day),
                        y: .value("Atterrissage prévu", Self.decimalValue(current.balance))
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(Color.homeHeroOverlay)
                    .annotation(position: .overlay) {
                        Circle()
                            .strokeBorder(accentColor, lineWidth: DesignTokens.BorderWidth.thick)
                            .frame(width: DesignTokens.Spacing.md, height: DesignTokens.Spacing.md)
                    }
                    // One label on this anchor, never two: the gap when there is room to
                    // print it, the day otherwise. It always lands on the far side of the
                    // rule from the plan's own label, so the two cannot meet — that overlap
                    // is what the mockups showed on an early day.
                    .annotation(
                        position: Self.gapLabelPosition(for: trajectory),
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text(Self.anchorLabel(for: trajectory, currency: currency))
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(
                                Self.showsGapLabel(for: trajectory)
                                    ? accentColor
                                    : Color.homeHeroSupport
                            )
                            .lineLimit(1)
                    }
                }
            }
            .chartXScale(domain: 0 ... trajectory.totalDays)
            .chartYScale(domain: Self.chartYDomain(for: trajectory))
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartLegend(.hidden)
            // The plot is a fixed-size graphic, so its two labels are part of the drawing and
            // are capped rather than left to grow across it. VoiceOver reads the whole
            // trajectory from the label below, which is the accessible route into a graph.
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .frame(height: DesignTokens.Chart.dashboardHeight)
            .sensitiveAmount()
            .accessibilityIdentifier("home-balance-chart")
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Self.chartAccessibilityLabel(
                for: trajectory,
                currency: currency,
                amountsHidden: amountsHidden
            ))
        }
    }

    /// What the forecast says about the days not yet lived: nothing new, so it holds its
    /// level. Empty on the last day of the period, where there is nothing left to project.
    static func projection(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> [BudgetFormulas.BalanceTrajectory.Point] {
        guard trajectory.today < trajectory.totalDays,
              let current = trajectory.landing.last else { return [] }
        return [current, .init(day: trajectory.totalDays, balance: current.balance)]
    }

    /// The two labels sit on opposite sides of the rule — the plan's away from the drift,
    /// the anchor's away from the rule. A month above its plan flips both, and neither
    /// arrangement can put them on the same band of the plot.
    static func ruleLabelPosition(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> AnnotationPosition {
        trajectory.drift > 0 ? .bottom : .top
    }

    static func gapLabelPosition(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> AnnotationPosition {
        trajectory.drift > 0 ? .top : .bottom
    }

    /// A gap wide enough to be seen gets named; anything narrower would print a figure over
    /// its own rule, and the `vs prévu` metric above the plot already carries it.
    static func showsGapLabel(for trajectory: BudgetFormulas.BalanceTrajectory) -> Bool {
        guard trajectory.drift != 0 else { return false }
        let gap = abs(decimalValue(trajectory.drift))
        return gap >= span(for: trajectory) * DesignTokens.Chart.gapLabelMinimumRatio
    }

    static func anchorLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency
    ) -> String {
        guard showsGapLabel(for: trajectory) else { return "Aujourd’hui" }
        return trajectory.drift.asArithmeticSignedCompactCurrency(currency)
    }

    /// Speaks the subtraction VoiceOver cannot see, in the drawing's own order: the plan the
    /// line opened on, where it now lands, and the day it left the plan. Not a reading of
    /// every point — the plot itself only ever shows those three things.
    static func chartAccessibilityLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency,
        amountsHidden: Bool
    ) -> String {
        guard !amountsHidden else {
            return "Trajectoire d’atterrissage de la période, montants masqués."
        }
        let plan = "Prévu \(trajectory.plannedBalance.asCompactCurrency(currency))."
        let estimate = "Atterrissage estimé \(trajectory.estimatedBalance.asCompactCurrency(currency))."
        guard trajectory.drift != 0 else {
            return "\(plan) \(estimate) Aucun écart au plan."
        }
        let gap = "Écart \(trajectory.drift.asArithmeticSignedCompactCurrency(currency))"
        // A gap with no date is a period whose drift predates its own first reading — the
        // figure still holds, so the sentence drops the clause rather than the fact.
        guard let since = trajectory.driftDate else { return "\(plan) \(estimate) \(gap)." }
        return "\(plan) \(estimate) \(gap) depuis le \(Formatters.dayMonthLabel(for: since))."
    }

    /// How much vertical room the drawing claims. A month that held its plan moves by a few
    /// francs; scaled to itself that reads as a plunge, so the floor is a fraction of what
    /// the period actually planned to spend.
    static func span(for trajectory: BudgetFormulas.BalanceTrajectory) -> Double {
        let values = trajectory.landing.map { decimalValue($0.balance) }
        let amplitude = (values.max() ?? 0) - (values.min() ?? 0)
        let floor = decimalValue(trajectory.plannedOutflows)
            * DesignTokens.Chart.landingScaleFloorRatio
        return max(amplitude, floor)
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let values = trajectory.landing.map { decimalValue($0.balance) }
        let lower = values.min() ?? 0
        let upper = values.max() ?? 1
        let span = span(for: trajectory)
        // The floor is spent as slack around the readings rather than added below them, so a
        // quiet month sits centred in its frame instead of pinned to the top of it.
        let slack = max(span - (upper - lower), 0) / 2
        let padding = max(
            span * DesignTokens.Chart.domainPaddingRatio,
            DesignTokens.Chart.minimumDomainPadding
        )
        // A band for each label, on the side that label sits: the plan's away from the
        // drift, the anchor's away from the rule. Reserved here rather than resolved at
        // draw time, because pushing a label back inside a full frame lands it on the line.
        let planBand = span * DesignTokens.Chart.planLabelBandRatio
        let anchorBand = span * DesignTokens.Chart.anchorLabelBandRatio
        let above = trajectory.drift > 0 ? anchorBand : planBand
        let below = trajectory.drift > 0 ? planBand : anchorBand
        return (lower - slack - padding - below) ... (upper + slack + padding + above)
    }

    private static func decimalValue(_ value: Decimal) -> Double {
        Double(truncating: value as NSDecimalNumber)
    }
}
