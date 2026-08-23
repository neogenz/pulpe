import Charts
import SwiftUI

// MARK: - Monthly Trajectory

extension HomeHeroCard {
    /// The month as a burn-down of what it has: the plan falls in a straight line from the
    /// opening amount to what it meant to keep, the real stroke falls by every outflow
    /// pointed so far, and from today a dashed stroke carries it to where the month lands if
    /// it keeps its pace. One figure on the plot, the trend's; the plan's is the hero's.
    @ViewBuilder
    var balanceChart: some View {
        if let trajectory {
            Chart {
                // The plan, as a rhythm rather than a calendar: forecasts carry no due date,
                // so the only honest shape is the straight fall from opening to remaining.
                ForEach(Self.plan(for: trajectory)) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Prévu", Self.decimalValue(point.balance)),
                        series: .value("Série", "Plan")
                    )
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        lineCap: .round,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .foregroundStyle(Color.heroInkSecondary.opacity(DesignTokens.Opacity.heroInkMuted))
                }
                if let planEnd = Self.plan(for: trajectory).last {
                    PointMark(
                        x: .value("Fin", planEnd.day),
                        y: .value("Prévu", Self.decimalValue(planEnd.balance))
                    )
                    .symbolSize(0)
                    .annotation(
                        position: Self.planLabelPosition(for: trajectory),
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text(AppLocale.string("Prévu"))
                            .padding(.trailing, DesignTokens.Spacing.xxl)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.heroInkSecondary)
                            .opacity(labelOpacity)
                    }
                }

                // The area under the real stroke: ink fading to nothing, the only fill on the
                // plot. What makes the line read as a surface rather than a wire.
                ForEach(trajectory.real) { point in
                    AreaMark(
                        x: .value("Jour", point.day),
                        yStart: .value("Plancher", Self.chartYDomain(for: trajectory).lowerBound),
                        yEnd: .value("Réel", Self.decimalValue(point.balance)),
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

                ForEach(trajectory.real) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Réel", Self.decimalValue(point.balance)),
                        series: .value("Série", "Réel")
                    )
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.chartLine,
                        lineCap: .round,
                        lineJoin: .round
                    ))
                    .foregroundStyle(Color.heroInk)
                }

                // The days not yet lived: from what is left today to where the month lands
                // if it carries on, trend included. One stroke, not two — the plan above it
                // is the reference, and the gap between the two ends is `Imprévus`.
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

                // The trend's own figure, once it is far enough from the plan to be a second
                // number: the hero prints where the month lands, this prints where it lands
                // if nothing changes.
                if Self.showsTrendLabel(for: trajectory), let end = Self.projection(for: trajectory).last {
                    PointMark(
                        x: .value("Fin", end.day),
                        y: .value("Tendance", Self.decimalValue(end.balance))
                    )
                    .symbolSize(0)
                    // Grows leftward from the plot's edge, and keeps the text inset the hero
                    // uses: the plot is edge to edge, so "fit to chart" alone would touch glass.
                    .annotation(
                        position: Self.trendLabelPosition(for: trajectory),
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text(Self.trendLabel(for: trajectory, currency: currency))
                            .padding(.trailing, DesignTokens.Spacing.xxl)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.heroInkSecondary)
                            .lineLimit(1)
                            .opacity(settlingOpacity * labelOpacity)
                    }
                }

                if let current = trajectory.real.last {
                    PointMark(
                        x: .value("Aujourd’hui", current.day),
                        y: .value("Réel", Self.decimalValue(current.balance))
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(Color.heroInk)
                    // Steps aside with the labels: one dot on the plot at a time.
                    .opacity(labelOpacity)
                    .annotation(position: .overlay) {
                        Circle()
                            .strokeBorder(Color.heroSurface, lineWidth: DesignTokens.BorderWidth.thick)
                            .frame(width: DesignTokens.Spacing.md, height: DesignTokens.Spacing.md)
                            .opacity(labelOpacity)
                    }
                    // The day only, below and to the left of the dot: under the stroke that
                    // reaches it, where neither the dashed tail nor the plan passes.
                    .annotation(
                        position: .bottom,
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text(AppLocale.string("Aujourd’hui"))
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.heroInkSecondary)
                            .lineLimit(1)
                            .opacity(labelOpacity)
                    }
                }

                // The finger's day: a rule through the plot and a dot on the stroke it
                // reads. No text on the plot — the hero figure above says the value and
                // its eyebrow the day, the way a price chart hands its reading to the title.
                if let scrubDay {
                    let reading = Self.scrubReading(at: scrubDay, in: trajectory)
                    RuleMark(x: .value("Jour", reading.day))
                        .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin))
                        .foregroundStyle(Color.heroInkSecondary.opacity(DesignTokens.Opacity.heroInkMuted))
                    // The dot sits on the stroke the day belongs to: real, else estimate.
                    if let value = reading.real ?? reading.estimate {
                        PointMark(
                            x: .value("Jour", reading.day),
                            y: .value("Lecture", Self.decimalValue(value))
                        )
                        .symbolSize(DesignTokens.Chart.pointSymbolArea)
                        .foregroundStyle(Color.heroInk)
                        .annotation(position: .overlay) {
                            Circle()
                                .strokeBorder(Color.heroSurface, lineWidth: DesignTokens.BorderWidth.thick)
                                .frame(width: DesignTokens.Spacing.md, height: DesignTokens.Spacing.md)
                        }
                    }
                }
            }
            .chartOverlay { proxy in scrubOverlay(proxy: proxy) }
            .sensoryFeedback(.selection, trigger: scrubDay)
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

    /// Pay day on the left, the period's end on the right: the plot is a timeline, and
    /// nothing else on it says so.
    @ViewBuilder
    var chartTimeAxis: some View {
        if let trajectory, let start = trajectory.periodStart, let end = trajectory.periodEnd {
            HStack {
                Text(Formatters.dayMonthLabel(for: start))
                Spacer(minLength: DesignTokens.Spacing.md)
                Text(Formatters.dayMonthLabel(for: end))
            }
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.heroInkSecondary)
            .lineLimit(1)
            .accessibilityElement(children: .combine)
            .accessibilityLabel(AppLocale.string(
                "Du \(Formatters.dayMonthLabel(for: start)) au \(Formatters.dayMonthLabel(for: end))"
            ))
        }
    }

    /// The fixed labels step aside while the finger's bubble is on the plot.
    var labelOpacity: Double { scrubDay == nil ? 1 : 0 }

    /// The skeleton's own pulse on the dashed stroke and its label while an entry settles —
    /// the same material the loading state uses, so "not final yet" reads the same way
    /// twice. Reduced motion holds the faded level without pulsing.
    var settlingOpacity: Double {
        guard isSettling else { return 1 }
        return settlePulse || reduceMotion ? DesignTokens.Opacity.settling : 1
    }

    /// The plan's straight fall, opening amount to planned remaining, over the whole period.
    static func plan(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> [BudgetFormulas.BalanceTrajectory.Point] {
        [
            .init(day: 0, balance: trajectory.plannedAvailable),
            .init(day: trajectory.totalDays, balance: trajectory.plannedBalance),
        ]
    }

    /// The days not yet lived, from what is left today to the trend's landing. Empty on the
    /// last day of the period, where there is nothing left to project.
    static func projection(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> [BudgetFormulas.BalanceTrajectory.Point] {
        guard trajectory.today < trajectory.totalDays,
              let current = trajectory.real.last else { return [] }
        return [current, .init(day: trajectory.totalDays, balance: trend(for: trajectory))]
    }

    static func trend(for trajectory: BudgetFormulas.BalanceTrajectory) -> Decimal {
        trajectory.trendBalance(priorDays: DesignTokens.Chart.trendPriorDays)
    }

    /// The trend gets its figure only once it is visibly apart from the plan's end; closer
    /// than that it would print a number on top of the word « Prévu ».
    static func showsTrendLabel(for trajectory: BudgetFormulas.BalanceTrajectory) -> Bool {
        guard !projection(for: trajectory).isEmpty else { return false }
        let gap = abs(decimalValue(trend(for: trajectory) - trajectory.plannedBalance))
        return gap > 0 && gap >= span(for: trajectory) * DesignTokens.Chart.gapLabelMinimumRatio
    }

    static func trendLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency
    ) -> String {
        AppLocale.string("Si tu continues : \(trend(for: trajectory).asCompactCurrency(currency))")
    }

    /// A label grows leftward from its stroke's end, so it has to sit on the side the
    /// stroke leaves free there: under a stroke that falls (the line is higher to the
    /// left), over one that climbs. The plan falls whenever the month plans to spend.
    static func planLabelPosition(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> AnnotationPosition {
        trajectory.plannedBalance < trajectory.plannedAvailable ? .bottom : .top
    }

    /// Same rule for the trend's figure: under a dashed stroke that keeps falling, over
    /// one that climbs back. A held month's stroke is flat and takes the top.
    static func trendLabelPosition(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> AnnotationPosition {
        guard let current = trajectory.real.last else { return .top }
        return trend(for: trajectory) < current.balance ? .bottom : .top
    }

    /// Speaks the three strokes VoiceOver cannot see, in the drawing's own order: what the
    /// period opened with, what the plan keeps, what is really left today, and where the
    /// month lands if it carries on.
    static func chartAccessibilityLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency,
        amountsHidden: Bool
    ) -> String {
        guard !amountsHidden else {
            return AppLocale.string("Trajectoire d’atterrissage de la période, montants masqués.")
        }
        // Self-contained sentences joined by a space, never one template: each is
        // translated whole, and only the order they are spoken in is fixed here.
        var spoken = [
            AppLocale.string("Disponible prévu \(trajectory.plannedAvailable.asAdaptiveCurrency(currency))."),
            AppLocale.string("Prévu fin de période \(trajectory.plannedBalance.asAdaptiveCurrency(currency))."),
            AppLocale.string(
                "Réel aujourd’hui \((trajectory.real.last?.balance ?? 0).asAdaptiveCurrency(currency))."
            ),
        ]
        if showsTrendLabel(for: trajectory) {
            spoken.append(AppLocale.string("Si tu continues, \(trend(for: trajectory).asCompactCurrency(currency))."))
        }
        return spoken.joined(separator: " ")
    }

    /// How much vertical room the drawing claims. A month that held its plan moves by a few
    /// francs; scaled to itself that reads as a plunge, so the floor is a fraction of what
    /// the period actually planned to spend.
    static func span(for trajectory: BudgetFormulas.BalanceTrajectory) -> Double {
        let values = plotted(trajectory)
        let amplitude = (values.max() ?? 0) - (values.min() ?? 0)
        let floor = decimalValue(trajectory.plannedOutflows)
            * DesignTokens.Chart.landingScaleFloorRatio
        return max(amplitude, floor)
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let values = plotted(trajectory)
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
        // A band for the labels below: today's sits under the dot, and the trend's figure
        // under the stroke for a month under its plan. Reserved here rather than resolved
        // at draw time, because pushing a label back inside a full frame lands it on the line.
        let band = span * DesignTokens.Chart.anchorLabelBandRatio
        return (lower - slackBelow - padding - band) ... (upper + slackAbove + padding)
    }

    /// Every value the plot draws: both plan ends, the real stroke, the trend's landing.
    private static func plotted(_ trajectory: BudgetFormulas.BalanceTrajectory) -> [Double] {
        (plan(for: trajectory) + trajectory.real).map { decimalValue($0.balance) }
            + [decimalValue(trend(for: trajectory))]
    }

    private static func decimalValue(_ value: Decimal) -> Double {
        Double(truncating: value.rounded(2) as NSDecimalNumber)
    }
}
