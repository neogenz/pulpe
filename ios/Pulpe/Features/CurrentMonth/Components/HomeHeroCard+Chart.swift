import Charts
import SwiftUI

// MARK: - Monthly Trajectory

extension HomeHeroCard {
    @ViewBuilder
    var balanceChart: some View {
        if let trajectory, trajectory.tracked.count > 1 {
            let isWaiting = trajectory.hasNothingTracked
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

                ForEach(trajectory.tracked) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Budget après pointage", Self.decimalValue(point.balance)),
                        series: .value("Série", "Suivi pointé")
                    )
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        lineJoin: .round
                    ))
                    .foregroundStyle(Color.homeHeroInk)
                }

                if !isWaiting {
                    ForEach(trajectory.remainingPlan) { point in
                        LineMark(
                            x: .value("Jour", point.day),
                            y: .value("Estimation finale", Self.decimalValue(point.balance)),
                            series: .value("Série", "Raccord de fin")
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
                }

                if let current = trajectory.tracked.last {
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

                if !isWaiting, let destination = trajectory.remainingPlan.last {
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
            // Sits in the band the projection would have occupied, and unlike an annotation
            // on the anchor it never drifts against an edge as the period advances.
            .overlay {
                if isWaiting {
                    Text("En attente d’un premier pointage")
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.homeHeroSupport)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }
            }
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
        guard let opening = trajectory.tracked.first,
              let current = trajectory.tracked.last else {
            return "Évolution du solde sur la période. Prévu \(planned)."
        }
        let start = "Début de période \(opening.balance.asCompactCurrency(currency))."
        let today = "Aujourd’hui \(current.balance.asCompactCurrency(currency))."
        guard !trajectory.hasNothingTracked,
              let destination = trajectory.remainingPlan.last else {
            return "\(start) \(today) En attente d’un pointage. Prévu \(planned)."
        }
        let estimate = "Fin de période estimée à \(destination.balance.asCompactCurrency(currency))."
        return "\(start) \(today) \(estimate) Prévu \(planned)."
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let balances = trajectory.tracked.map(\.balance)
            + trajectory.remainingPlan.map(\.balance)
            + [trajectory.plannedBalance]
        let values = balances.map(Self.decimalValue)
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
