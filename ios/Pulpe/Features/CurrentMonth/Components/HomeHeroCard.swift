import Charts
import SwiftUI

/// Month-end estimate hero. Financial formulas stay in `BudgetFormulas`; this view only
/// translates their results into the signed, glanceable comparison shown on the dashboard.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    let plannedBalance: Decimal
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
        PresentationState(
            plannedBalance: plannedBalance,
            estimatedBalance: metrics.remaining
        )
    }

    // MARK: - Semantic Styling

    private var accentColor: Color {
        switch presentation.tone {
        case .favorable: .financialSavings
        case .caution: .financialOverBudget
        case .deficit: .driftAccent
        }
    }

    private var comparisonText: String {
        switch presentation.verdict {
        case .gain:
            "\(abs(presentation.variance).asCompactCurrency(currency)) de mieux que prévu"
        case .overrun:
            "\(abs(presentation.variance).asCompactCurrency(currency)) de moins que prévu"
        case .onPlan:
            "Conforme à ton budget"
        }
    }

    private var uncheckedText: String { "\(uncheckedCount) à pointer" }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        presentation.accessibilityDescription(
            monthName: monthName,
            currency: currency,
            amountsHidden: amountsHidden,
            uncheckedCount: uncheckedCount
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
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Text("Voir le budget")
                    Spacer(minLength: DesignTokens.Spacing.md)
                    Image(systemName: "chevron.right")
                }
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.homeHeroInk)
            }
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .contentShape(Rectangle())
            .textLinkButtonStyle()
            .accessibilityLabel("Voir le détail du budget")
        }
    }

    // MARK: - Summary

    private var metricsContent: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                Text(presentation.estimatedBalance.asArithmeticSignedCompactCurrency(currency))
                    .font(PulpeTypography.heroIcon)
                    .tracking(DesignTokens.Tracking.hero)
                    .monospacedDigit()
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .foregroundStyle(Color.homeHeroInk)
                    .sensitiveAmount()

                Text("estimé fin \(monthName)")
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
                comparisonLabel
                uncheckedLabel
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                comparisonLabel
                Spacer(minLength: DesignTokens.Spacing.sm)
                uncheckedLabel
            }
        }
    }

    private var comparisonLabel: some View {
        Text(comparisonText)
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(accentColor)
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
            .sensitiveAmount()
    }

    private var uncheckedLabel: some View {
        Text(uncheckedText)
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.homeHeroSupport)
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Monthly Trajectory

    @ViewBuilder
    private var balanceChart: some View {
        if let trajectory, trajectory.tracked.count > 1 {
            Chart {
                RuleMark(y: .value("Solde prévu", Self.decimalValue(trajectory.plannedBalance)))
                    .foregroundStyle(
                        Color.homeHeroSupport.opacity(DesignTokens.Opacity.heavy)
                    )
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(position: .top, alignment: .leading) {
                        Text("Solde prévu")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                    }

                ForEach(trajectory.tracked) { point in
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

                ForEach(trajectory.remainingPlan) { point in
                    LineMark(
                        x: .value("Jour", point.day),
                        y: .value("Solde estimé", Self.decimalValue(point.balance)),
                        series: .value("Série", "Reste du plan")
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

// MARK: - Presentation State

extension HomeHeroCard {
    struct PresentationState: Equatable {
        enum Verdict: Equatable {
            case gain
            case overrun
            case onPlan
        }

        enum Tone: Equatable {
            case favorable
            case caution
            case deficit
        }

        let plannedBalance: Decimal
        let estimatedBalance: Decimal
        let variance: Decimal
        let verdict: Verdict
        let tone: Tone

        init(plannedBalance: Decimal, estimatedBalance: Decimal) {
            self.plannedBalance = plannedBalance
            self.estimatedBalance = estimatedBalance

            let difference = estimatedBalance - plannedBalance
            variance = difference
            verdict = difference > 0 ? .gain : difference < 0 ? .overrun : .onPlan
            tone = estimatedBalance < 0 ? .deficit : difference < 0 ? .caution : .favorable
        }

        func accessibilityDescription(
            monthName: String,
            currency: SupportedCurrency,
            amountsHidden: Bool,
            uncheckedCount: Int
        ) -> String {
            let month = monthName.capitalized
            let unchecked = switch uncheckedCount {
            case 0: "Aucune opération à pointer."
            case 1: "1 opération à pointer."
            default: "\(uncheckedCount) opérations à pointer."
            }
            guard !amountsHidden else {
                return """
                \(month). Solde estimé fin de mois, montant masqué. \
                Comparaison au budget masquée. \(unchecked)
                """
            }

            let comparison: String
            switch verdict {
            case .gain:
                comparison = "\(abs(variance).asCurrency(currency)) de mieux que prévu"
            case .overrun:
                comparison = "\(abs(variance).asCurrency(currency)) de moins que prévu"
            case .onPlan:
                comparison = "Conforme à ton budget"
            }

            return """
            \(month). Solde estimé fin de mois \
            \(estimatedBalance.asArithmeticSignedCurrency(currency)). \(comparison). \(unchecked)
            """
        }
    }
}

#Preview("Estimated balance hero") {
    let gainTrajectory = BudgetFormulas.BalanceTrajectory(
        tracked: [
            .init(day: 0, balance: 8032),
            .init(day: 3, balance: 7580),
            .init(day: 8, balance: 6810),
            .init(day: 12, balance: 6430),
            .init(day: 17, balance: 5992),
        ],
        remainingPlan: [
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
                totalExpenses: 6772,
                totalSavings: 0,
                available: 8032,
                endingBalance: 1260,
                remaining: 1260,
                rollover: 0
            ),
            plannedBalance: 632,
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
