import Charts
import SwiftUI

// MARK: - Monthly Trajectory

extension HomeHeroCard {
    @ViewBuilder
    var balanceChart: some View {
        if let trajectory, trajectory.landing.count > 1 {
            Chart {
                RuleMark(y: .value(
                    "Prévu",
                    Self.decimalValue(trajectory.plannedBalance)
                ))
                    .foregroundStyle(Color.homeHeroSupport)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    // The chart's only named line, so its label carries no qualifier.
                    .annotation(position: .bottom, alignment: .leading) {
                        Text("Prévu")
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
                    .foregroundStyle(Color.homeHeroInk)
                }

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
                    // Same ink as the tracked series, faded: the projection is the same
                    // story seen further out, not a different quantity.
                    .foregroundStyle(
                        Color.homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted)
                    )
                }

                if let current = trajectory.landing.last {
                    PointMark(
                        x: .value("Aujourd'hui", current.day),
                        y: .value("Solde aujourd'hui", Self.decimalValue(current.balance))
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(Color.homeHeroOverlay)
                    .annotation(position: .overlay) {
                        Circle()
                            .strokeBorder(Color.homeHeroInk, lineWidth: DesignTokens.BorderWidth.thick)
                            .frame(width: DesignTokens.Spacing.md, height: DesignTokens.Spacing.md)
                    }
                    // The anchor names itself instead of a vertical rule crossing the curve.
                    // The label hangs back over the days already travelled: the projection
                    // always leaves the anchor forward, and centred under it the text was
                    // struck through by that line. Late in a period the anchor sits against
                    // the trailing edge, so the label is pushed back inside rather than clipped.
                    .annotation(
                        position: .bottom,
                        alignment: .trailing,
                        spacing: DesignTokens.Spacing.xs,
                        overflowResolution: .init(x: .fit(to: .chart), y: .disabled)
                    ) {
                        Text("Aujourd’hui")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                            .lineLimit(1)
                    }
                }

                if let destination = Self.projection(for: trajectory).last {
                    PointMark(
                        x: .value("Fin de période", destination.day),
                        y: .value(
                            "Estimation finale",
                            Self.decimalValue(destination.balance)
                        )
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(
                        Color.homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted)
                    )
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

    /// Speaks the trajectory VoiceOver cannot see: where the period opened, where it stands
    /// today, where it is heading, and the plan it is measured against.
    static func chartAccessibilityLabel(
        for trajectory: BudgetFormulas.BalanceTrajectory,
        currency: SupportedCurrency,
        amountsHidden: Bool
    ) -> String {
        guard !amountsHidden else {
            return "Évolution du solde sur la période, montants masqués."
        }
        let planned = trajectory.plannedBalance.asCompactCurrency(currency)
        guard let opening = trajectory.landing.first,
              let current = trajectory.landing.last else {
            return "Évolution du solde sur la période. Prévu \(planned)."
        }
        let start = "Début de période \(opening.balance.asCompactCurrency(currency))."
        let today = "Aujourd’hui \(current.balance.asCompactCurrency(currency))."
        // The plot draws its projection from the first day on, so the label describes it
        // from the first day on too. One case has none to describe: the last day of the
        // period, where saying why beats falling silent mid-sentence.
        guard let destination = Self.projection(for: trajectory).last else {
            return "\(start) \(today) Dernier jour de la période. Prévu \(planned)."
        }
        let estimate = "Fin de période estimée à \(destination.balance.asCompactCurrency(currency))."
        return "\(start) \(today) \(estimate) Prévu \(planned)."
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let values = trajectory.landing.map { Self.decimalValue($0.balance) }
        let lower = values.min() ?? 0
        let upper = values.max() ?? 1
        let padding = max(
            (upper - lower) * DesignTokens.Chart.domainPaddingRatio,
            DesignTokens.Chart.minimumDomainPadding
        )
        return (lower - padding) ... (upper + padding)
    }

    private static func decimalValue(_ value: Decimal) -> Double {
        Double(truncating: value as NSDecimalNumber)
    }
}
