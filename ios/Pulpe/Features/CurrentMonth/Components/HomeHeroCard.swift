import Charts
import SwiftUI

/// Month-end projection hero. Financial formulas stay in `BudgetFormulas`; this view only
/// translates their results into the signed, glanceable comparison shown on the dashboard.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    let projection: BudgetFormulas.Projection?
    let trajectory: BudgetFormulas.BalanceTrajectory?
    let monthName: String
    let uncheckedCount: Int
    var onTapMetrics: () -> Void
    var onTapDetail: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var chartHeight = DesignTokens.Chart.dashboardHeight
    @State private var tapTrigger = false

    private var currency: SupportedCurrency { userSettingsStore.currency }
    private var presentation: PresentationState {
        PresentationState(plannedBalance: metrics.remaining, projection: projection)
    }

    // MARK: - Semantic Styling

    private var accentColor: Color {
        switch presentation.tone {
        case .favorable: .financialSavings
        case .caution: .homeHeroInk
        case .deficit: .driftAccent
        case .neutral: .homeHeroInk
        }
    }

    private var varianceTitle: String {
        switch presentation.verdict {
        case .gain: "Gain"
        case .overrun: "Dépassement"
        case .onPlan: "Écart"
        case .unavailable: "Écart"
        }
    }

    private var varianceValue: String {
        presentation.variance?.asArithmeticSignedCompactCurrency(currency) ?? "—"
    }

    private var insight: String {
        guard let projection else { return "Projection indisponible" }
        let dailyRate = projection.dailySpendingRate.asCompactCurrency(currency)
        let days = projection.daysRemaining
        return "\(dailyRate)/jour · \(days) \(days == 1 ? "jour" : "jours")"
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        presentation.accessibilityDescription(
            monthName: monthName,
            currency: currency,
            amountsHidden: amountsHidden
        )
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Button {
                tapTrigger.toggle()
                onTapMetrics()
            } label: {
                metricsContent
            }
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Ouvrir le suivi du réalisé")

            Button(action: onTapDetail) {
                if dynamicTypeSize >= .xxLarge {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        HStack {
                            Text("Budget")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.homeHeroInk)

                        Text(insight)
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.homeHeroSupport)
                            .monospacedDigit()
                            .sensitiveAmount()
                    }
                } else {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Text("Budget")
                            .font(PulpeTypography.labelLarge)
                            .foregroundStyle(Color.homeHeroInk)

                        Spacer(minLength: DesignTokens.Spacing.md)

                        Text(insight)
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(Color.homeHeroSupport)
                            .monospacedDigit()
                            .sensitiveAmount()

                        Image(systemName: "chevron.right")
                            .font(PulpeTypography.labelLarge)
                            .foregroundStyle(Color.homeHeroInk)
                    }
                }
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .contentShape(Rectangle())
            .textLinkButtonStyle()
            .accessibilityLabel("Détail du budget, \(insight)")
        }
    }

    // MARK: - Summary

    private var metricsContent: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                Text(presentation.displayedBalance.asArithmeticSignedCompactCurrency(currency))
                    .font(PulpeTypography.heroIcon)
                    .tracking(DesignTokens.Tracking.hero)
                    .monospacedDigit()
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .foregroundStyle(Color.homeHeroInk)
                    .sensitiveAmount()

                Text(
                    presentation.projectedBalance == nil
                        ? "solde planifié"
                        : "solde final projeté"
                )
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.homeHeroSupport)
            }

            summaryMetrics
            balanceChart
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Compact Summary

    @ViewBuilder
    private var summaryMetrics: some View {
        if dynamicTypeSize >= .xxLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                moneyMetric(
                    title: "Plan",
                    value: metrics.remaining.asArithmeticSignedCompactCurrency(currency)
                )
                moneyMetric(title: varianceTitle, value: varianceValue)
                countMetric
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(spacing: DesignTokens.Spacing.none) {
                moneyMetric(
                    title: "Plan",
                    value: metrics.remaining.asArithmeticSignedCompactCurrency(currency)
                )
                Divider()
                    .frame(height: DesignTokens.TapTarget.minimum)
                moneyMetric(title: varianceTitle, value: varianceValue)
                Divider()
                    .frame(height: DesignTokens.TapTarget.minimum)
                countMetric
            }
        }
    }

    private func moneyMetric(title: String, value: String) -> some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text(value)
                .font(PulpeTypography.progressValue)
                .foregroundStyle(Color.homeHeroInk)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .sensitiveAmount()

            Text(title)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.homeHeroSupport)
        }
        .frame(maxWidth: .infinity)
    }

    private var countMetric: some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text("\(uncheckedCount)")
                .font(PulpeTypography.progressValue)
                .foregroundStyle(Color.homeHeroInk)
                .monospacedDigit()

            Text("À pointer")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.homeHeroSupport)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Monthly Trajectory

    @ViewBuilder
    private var balanceChart: some View {
        if let trajectory, trajectory.actual.count > 1 {
            Chart {
                RuleMark(y: .value("Solde prévu", Self.decimalValue(trajectory.plannedBalance)))
                    .foregroundStyle(
                        Color.homeHeroSupport.opacity(DesignTokens.Opacity.heavy)
                    )
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(position: .top, alignment: .trailing) {
                        Text("Solde prévu")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                    }

                ForEach(trajectory.actual) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Solde réel", Self.decimalValue(point.balance)),
                        series: .value("Série", "Réel")
                    )
                    .interpolationMethod(.monotone)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        lineJoin: .round
                    ))
                    .foregroundStyle(Color.homeHeroInk)
                }

                ForEach(trajectory.projected) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Solde projeté", Self.decimalValue(point.balance)),
                        series: .value("Série", "Projection")
                    )
                    .interpolationMethod(.linear)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thick,
                        lineCap: .round,
                        dash: DesignTokens.Chart.dash
                    ))
                    .foregroundStyle(accentColor)
                }

                RuleMark(x: .value("Aujourd'hui", trajectory.today))
                    .foregroundStyle(Color.homeHeroSupport)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(position: .bottom, alignment: .trailing) {
                        Text("Aujourd’hui")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                    }

                if let current = trajectory.actual.last {
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
                }
            }
            .chartXScale(domain: 0 ... trajectory.totalDays)
            .chartYScale(domain: Self.chartYDomain(for: trajectory))
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartLegend(.hidden)
            .frame(height: chartHeight)
            .sensitiveAmount()
            .accessibilityHidden(true)
        }
    }

    static func chartYDomain(
        for trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ClosedRange<Double> {
        let balances = trajectory.actual.map(\.balance)
            + trajectory.projected.map(\.balance)
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

// MARK: - Presentation State

extension HomeHeroCard {
    struct PresentationState: Equatable {
        enum Verdict: Equatable {
            case gain
            case overrun
            case onPlan
            case unavailable
        }

        enum Tone: Equatable {
            case favorable
            case caution
            case deficit
            case neutral
        }

        let plannedBalance: Decimal
        let projectedBalance: Decimal?
        let variance: Decimal?
        let verdict: Verdict
        let tone: Tone

        var displayedBalance: Decimal { projectedBalance ?? plannedBalance }

        init(plannedBalance: Decimal, projection: BudgetFormulas.Projection?) {
            self.init(
                plannedBalance: plannedBalance,
                projectedBalance: projection?.projectedEndOfMonthBalance
            )
        }

        init(plannedBalance: Decimal, projectedBalance: Decimal?) {
            self.plannedBalance = plannedBalance
            self.projectedBalance = projectedBalance

            guard let projectedBalance else {
                variance = nil
                verdict = .unavailable
                tone = .neutral
                return
            }

            let difference = projectedBalance - plannedBalance
            variance = difference
            verdict = difference > 0 ? .gain : difference < 0 ? .overrun : .onPlan
            tone = projectedBalance < 0 ? .deficit : difference < 0 ? .caution : .favorable
        }

        func accessibilityDescription(
            monthName: String,
            currency: SupportedCurrency,
            amountsHidden: Bool
        ) -> String {
            let month = monthName.capitalized
            guard !amountsHidden else {
                return "\(month). Solde final projeté, montant masqué. Comparaison au plan masquée."
            }
            guard let projectedBalance, let variance else {
                return """
                \(month). Solde planifié \(plannedBalance.asArithmeticSignedCurrency(currency)). \
                Projection indisponible.
                """
            }

            let comparison: String
            switch verdict {
            case .gain:
                comparison = "Gain sur le plan \(variance.asArithmeticSignedCurrency(currency))"
            case .overrun:
                comparison = "Dépassement du plan \(variance.asArithmeticSignedCurrency(currency))"
            case .onPlan:
                comparison = "Conforme au plan"
            case .unavailable:
                comparison = "Projection indisponible"
            }

            return """
            \(month). Solde final projeté \(projectedBalance.asArithmeticSignedCurrency(currency)). \
            Plan \(plannedBalance.asArithmeticSignedCurrency(currency)). \(comparison).
            """
        }
    }
}

#Preview("Projection hero") {
    let gain = BudgetFormulas.Projection(
        projectedEndOfMonthBalance: 1260,
        dailySpendingRate: 120,
        daysElapsed: 17,
        daysRemaining: 14,
        isOnTrack: true
    )
    let gainTrajectory = BudgetFormulas.BalanceTrajectory(
        actual: [
            .init(day: 0, balance: 8032),
            .init(day: 3, balance: 7580),
            .init(day: 8, balance: 6810),
            .init(day: 12, balance: 6430),
            .init(day: 17, balance: 5992),
        ],
        projected: [
            .init(day: 17, balance: 5992),
            .init(day: 31, balance: 1260),
        ],
        plannedBalance: 632,
        today: 17,
        totalDays: 31
    )
    ScrollView {
        HomeHeroCard(
            metrics: .init(
                totalIncome: 8032,
                totalExpenses: 7400,
                totalSavings: 0,
                available: 8032,
                endingBalance: 632,
                remaining: 632,
                rollover: 0
            ),
            projection: gain,
            trajectory: gainTrajectory,
            monthName: "juillet",
            uncheckedCount: 5,
            onTapMetrics: {},
            onTapDetail: {}
        )
        .padding(DesignTokens.Spacing.lg)
    }
    .background(Color.homeBackground)
    .environment(UserSettingsStore())
}
