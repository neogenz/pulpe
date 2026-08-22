import Charts
import SwiftUI

// MARK: - Monthly Trajectory

extension HomeHeroCard {
    /// The month's landing forecast: it opens on the plan, it arrives on the figure above
    /// it, and it only leaves the horizontal when the month leaves its plan. Two strokes and
    /// a point: what the days lived did to the forecast, where it holds from today, and the
    /// gap named at the anchor. No rule for the plan and none for today — the line's own
    /// first reading is the plan, and the dot is today.
    @ViewBuilder
    var balanceChart: some View {
        if let trajectory {
            Chart {
                // The area under the tracked series: ink fading to nothing, the only fill on
                // the plot. Always drawn, a held month included — the fill is what makes the
                // line read as a surface rather than a wire, not a signal about the gap.
                ForEach(trajectory.landing) { point in
                    AreaMark(
                        x: .value("Jour", point.day),
                        yStart: .value("Plancher", Self.chartYDomain(for: trajectory).lowerBound),
                        yEnd: .value("Atterrissage prévu", Self.decimalValue(point.balance)),
                        series: .value("Série", "Aire")
                    )
                    .interpolationMethod(.monotone)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.heroInk.opacity(DesignTokens.Opacity.heroArea), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                }

                ForEach(trajectory.landing) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Atterrissage prévu", Self.decimalValue(point.balance)),
                        series: .value("Série", "Atterrissage")
                    )
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.chartLine,
                        lineCap: .round,
                        lineJoin: .round
                    ))
                    .foregroundStyle(Color.heroInk)
                }

                // The days not yet lived, at the pace of the days lived: the stroke bends
                // toward where the month lands if it carries on, and holds level when the
                // month holds its plan.
                ForEach(Self.projection(for: trajectory)) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Estimation finale", Self.decimalValue(point.balance)),
                        series: .value("Série", "Projection")
                    )
                    .interpolationMethod(.linear)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.chartLine,
                        lineCap: .round,
                        dash: DesignTokens.Chart.dash
                    ))
                    .foregroundStyle(Color.heroInk.opacity(DesignTokens.Opacity.heroInkMuted))
                    .opacity(settlingOpacity)
                }

                // The trend's own figure, once it is far enough from the estimate to be a
                // second number: the hero prints where the month lands, this prints where it
                // lands if nothing changes.
                if Self.showsTrendLabel(for: trajectory), let end = Self.projection(for: trajectory).last {
                    PointMark(
                        x: .value("Fin", end.day),
                        y: .value("Tendance", Self.decimalValue(end.balance))
                    )
                    .symbolSize(0)
                    // Grows leftward from the plot's edge, and keeps the text inset the hero
                    // uses: the plot is edge to edge, so "fit to chart" alone would touch glass.
                    .annotation(
                        position: Self.gapLabelPosition(for: trajectory),
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text(Self.trendLabel(for: trajectory, currency: currency))
                            .padding(.trailing, DesignTokens.Spacing.xxl)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.heroInkSecondary)
                            .lineLimit(1)
                            .opacity(settlingOpacity)
                    }
                }

                if let current = trajectory.landing.last {
                    PointMark(
                        x: .value("Aujourd’hui", current.day),
                        y: .value("Atterrissage prévu", Self.decimalValue(current.balance))
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(Color.heroInk)
                    .annotation(position: .overlay) {
                        Circle()
                            .strokeBorder(Color.heroSurface, lineWidth: DesignTokens.BorderWidth.thick)
                            .frame(width: DesignTokens.Spacing.md, height: DesignTokens.Spacing.md)
                    }
                    // One label on this anchor, never two: the gap when there is room to
                    // print it, the day otherwise. It lands on the far side of the line's
                    // origin level, where the plot is empty by construction.
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
                                    : Color.heroInkSecondary
                            )
                            .lineLimit(1)
                    }
                }
            }
            .chartXScale(domain: 0 ... trajectory.totalDays)
            // The projection springs to its new end once the server has settled an entry;
            // under reduced motion it crossfades there instead.
            .animation(
                reduceMotion
                    ? .easeInOut(duration: DesignTokens.Animation.normal)
                    : DesignTokens.Animation.defaultSpring,
                value: Self.trend(for: trajectory)
            )
            .animation(
                settlePulse && !reduceMotion
                    ? .easeInOut(duration: 1.0).repeatForever(autoreverses: true)
                    : .easeInOut(duration: DesignTokens.Animation.fast),
                value: settlePulse
            )
            .onChange(of: isSettling, initial: true) { _, settling in
                settlePulse = settling
            }
            // Edge to edge: cancels the hero's text inset so the plot spans the screen.
            .chartPlotStyle { $0.padding(0) }
            .padding(.horizontal, -DesignTokens.Spacing.xxl)
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
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Self.chartAccessibilityLabel(
                for: trajectory,
                currency: currency,
                amountsHidden: amountsHidden
            ))
            // After `.accessibilityElement(children:)`, so the identifier lands on the
            // element that speaks the trajectory rather than on the silent view above it.
            .accessibilityIdentifier("home-balance-chart")
        }
    }

    /// The skeleton's own pulse on the dashed stroke and its label while an entry settles —
    /// the same material the loading state uses, so "not final yet" reads the same way
    /// twice. Reduced motion holds the faded level without pulsing.
    var settlingOpacity: Double {
        guard isSettling else { return 1 }
        return settlePulse || reduceMotion ? DesignTokens.Opacity.settling : 1
    }

    /// The days not yet lived, from today's reading to the trend's landing. Empty on the
    /// last day of the period, where there is nothing left to project.
    static func projection(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> [BudgetFormulas.BalanceTrajectory.Point] {
        guard trajectory.today < trajectory.totalDays,
              let current = trajectory.landing.last else { return [] }
        return [current, .init(day: trajectory.totalDays, balance: trend(for: trajectory))]
    }

    static func trend(for trajectory: BudgetFormulas.BalanceTrajectory) -> Decimal {
        trajectory.trendBalance(priorDays: DesignTokens.Chart.trendPriorDays)
    }

    /// The trend gets its figure only once it is visibly apart from the estimate; closer
    /// than that it would print a second number on top of the first.
    static func showsTrendLabel(for trajectory: BudgetFormulas.BalanceTrajectory) -> Bool {
        let gap = abs(decimalValue(trend(for: trajectory) - trajectory.estimatedBalance))
        return gap >= span(for: trajectory) * DesignTokens.Chart.gapLabelMinimumRatio
    }

    static func trendLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency
    ) -> String {
        AppLocale.string("à ce rythme \(trend(for: trajectory).asCompactCurrency(currency))")
    }

    /// The anchor label sits away from the plan level — below the dot for a month under its
    /// plan, above it for a month over — where the plot is empty by construction.
    static func gapLabelPosition(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> AnnotationPosition {
        trajectory.drift.rounded(2) > 0 ? .top : .bottom
    }

    /// A gap wide enough to be seen gets named; anything narrower would print a figure over
    /// its own rule, and the `vs prévu` metric above the plot already carries it.
    static func showsGapLabel(for trajectory: BudgetFormulas.BalanceTrajectory) -> Bool {
        guard trajectory.drift.rounded(2) != 0 else { return false }
        let gap = abs(decimalValue(trajectory.drift))
        return gap >= span(for: trajectory) * DesignTokens.Chart.gapLabelMinimumRatio
    }

    static func anchorLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency
    ) -> String {
        guard showsGapLabel(for: trajectory) else { return AppLocale.string("Aujourd’hui") }
        let drift = trajectory.drift.rounded(2)
        return "\(drift > 0 ? "+" : "")\(drift.asAdaptiveCurrency(currency))"
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
            return AppLocale.string("Trajectoire d’atterrissage de la période, montants masqués.")
        }
        // Three self-contained sentences joined by a space, never one template: each is
        // translated whole, and only the order they are spoken in is fixed here.
        let plan = AppLocale.string("Prévu \(trajectory.plannedBalance.asAdaptiveCurrency(currency)).")
        let estimate = AppLocale.string(
            "Atterrissage estimé \(trajectory.estimatedBalance.asAdaptiveCurrency(currency))."
        )
        let roundedDrift = trajectory.drift.rounded(2)
        guard roundedDrift != 0 else {
            return "\(plan) \(estimate) " + AppLocale.string("Aucun écart au plan.")
        }
        let drift = "\(roundedDrift > 0 ? "+" : "")\(roundedDrift.asAdaptiveCurrency(currency))"
        // A gap with no date is a period whose drift predates its own first reading — the
        // figure still holds, so the sentence drops the clause rather than the fact.
        guard let since = trajectory.driftDate else {
            return "\(plan) \(estimate) " + AppLocale.string("Écart \(drift).")
        }
        let day = Formatters.dayMonthLabel(for: since)
        let spoken = "\(plan) \(estimate) " + AppLocale.string("Écart \(drift) depuis le \(day).")
        guard showsTrendLabel(for: trajectory) else { return spoken }
        return spoken + " " + AppLocale.string(
            "À ce rythme, \(trend(for: trajectory).asCompactCurrency(currency))."
        )
    }

    /// How much vertical room the drawing claims. A month that held its plan moves by a few
    /// francs; scaled to itself that reads as a plunge, so the floor is a fraction of what
    /// the period actually planned to spend.
    static func span(for trajectory: BudgetFormulas.BalanceTrajectory) -> Double {
        let values = trajectory.landing.map { decimalValue($0.balance) } + [decimalValue(trend(for: trajectory))]
        let amplitude = (values.max() ?? 0) - (values.min() ?? 0)
        let floor = decimalValue(trajectory.plannedOutflows)
            * DesignTokens.Chart.landingScaleFloorRatio
        return max(amplitude, floor)
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let values = trajectory.landing.map { decimalValue($0.balance) } + [decimalValue(trend(for: trajectory))]
        let lower = values.min() ?? 0
        let upper = values.max() ?? 1
        let span = span(for: trajectory)
        // The floor is spent as slack around the readings rather than added below them, so a
        // quiet month is not pinned to the top of its frame. Three quarters of it go under the
        // line: the fill lives there, and empty sky above a flat line reads as a missing plot.
        let slack = max(span - (upper - lower), 0)
        let slackAbove = slack / 4
        let slackBelow = slack - slackAbove
        let padding = max(
            span * DesignTokens.Chart.domainPaddingRatio,
            DesignTokens.Chart.minimumDomainPadding
        )
        // A band for the anchor label on the side it sits, away from the rule. Reserved here
        // rather than resolved at draw time, because pushing a label back inside a full
        // frame lands it on the line.
        let anchorBand = span * DesignTokens.Chart.anchorLabelBandRatio
        let above = trajectory.drift.rounded(2) > 0 ? anchorBand : 0
        let below = trajectory.drift.rounded(2) > 0 ? 0 : anchorBand
        return (lower - slackBelow - padding - below) ... (upper + slackAbove + padding + above)
    }

    private static func decimalValue(_ value: Decimal) -> Double {
        Double(truncating: value.rounded(2) as NSDecimalNumber)
    }
}
