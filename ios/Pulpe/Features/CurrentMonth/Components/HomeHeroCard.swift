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

    /// Qualitative half of the verdict. The number behind it lives in the `vs prévu`
    /// metric, so the sentence never repeats it.
    private var verdictText: String {
        switch presentation.verdict {
        case .gain: "Il te reste plus que prévu."
        case .overrun: "Il te reste moins que prévu."
        case .onPlan: "Tu es conforme à ton budget."
        }
    }

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

            verdictSentence
        }
    }

    // MARK: - Summary

    private var metricsContent: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            VStack(spacing: DesignTokens.Spacing.xs) {
                heroAmount
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

    // MARK: - Split Amount

    /// Dominant figure and its currency suffix on one baseline. Only a negative balance
    /// carries a sign — a `+` on money you still have reads as a variation, not a sum.
    private var heroAmount: Text {
        Text(presentation.estimatedBalance.asCompactAmount(for: currency))
            .font(PulpeTypography.dashboardHeroAmount)
            .tracking(DesignTokens.Tracking.hero)
            + Text(" \(currency.symbol)")
            .font(PulpeTypography.dashboardHeroCurrency)
    }

    // MARK: - Compact Summary

    @ViewBuilder
    private var summaryMetrics: some View {
        if dynamicTypeSize >= .xxLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: "à pointer", tint: Color.homeHeroInk)
                metric(value: varianceValue, label: "vs prévu", tint: accentColor)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                metric(value: uncheckedValue, label: "à pointer", tint: Color.homeHeroInk)
                Spacer(minLength: DesignTokens.Spacing.sm)
                // Bookends of the hero: the right-hand pair hangs off the trailing margin
                // so both metrics share the hero's own edges.
                metric(
                    value: varianceValue,
                    label: "vs prévu",
                    tint: accentColor,
                    alignment: .trailing
                )
            }
        }
    }

    private var uncheckedValue: String { "\(uncheckedCount)" }

    private var varianceValue: String {
        presentation.variance.asSignedCompactAmount(for: currency)
    }

    /// Value over its own label, so neither depends on the copy around it to be read.
    private func metric(
        value: String,
        label: String,
        tint: Color,
        alignment: HorizontalAlignment = .leading
    ) -> some View {
        VStack(alignment: alignment, spacing: DesignTokens.Spacing.xxs) {
            Text(value)
                .font(PulpeTypography.amountCard)
                .foregroundStyle(tint)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .sensitiveAmount()

            Text(label)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.homeHeroSupport)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Verdict

    /// One sentence that ends in its own action — the row that used to carry `Voir le budget`
    /// is gone, so the creation action below is the strongest thing under the hero.
    private var verdictSentence: some View {
        Button(action: onTapDetail) {
            Text(verdictText)
                .foregroundStyle(accentColor)
                + Text(" Voir le détail.")
                .foregroundStyle(Color.homeHeroInk)
                .underline()
        }
        .font(PulpeTypography.labelLarge)
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .textLinkButtonStyle()
        // The verdict is already spoken by the metrics element above; repeating it here
        // would make VoiceOver say it twice in a row.
        .accessibilityLabel("Voir le détail du budget")
    }

    // MARK: - Monthly Trajectory

    @ViewBuilder
    private var balanceChart: some View {
        if let trajectory, trajectory.tracked.count > 1 {
            let annotations = ChartAnnotationLayout(dynamicTypeSize: dynamicTypeSize)
            Chart {
                RuleMark(y: .value(
                    "Prévu fin de période",
                    Self.decimalValue(trajectory.plannedBalance)
                ))
                    .foregroundStyle(
                        Color.homeHeroSupport.opacity(DesignTokens.Opacity.heavy)
                    )
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(
                        position: annotations.plannedPosition,
                        alignment: annotations.plannedAlignment
                    ) {
                        Text(annotations.plannedLabel)
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
                    .foregroundStyle(accentColor)
                }

                RuleMark(x: .value("Aujourd'hui", trajectory.today))
                    .foregroundStyle(Color.homeHeroSupport)
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(
                        position: annotations.todayPosition,
                        alignment: annotations.todayAlignment
                    ) {
                        Text(annotations.todayLabel)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                            .lineLimit(1)
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

                if let destination = trajectory.remainingPlan.last {
                    PointMark(
                        x: .value("Fin de période", destination.day),
                        y: .value(
                            "Estimation finale",
                            Self.decimalValue(destination.balance)
                        )
                    )
                    .symbolSize(DesignTokens.Chart.pointSymbolArea)
                    .foregroundStyle(accentColor)
                    .annotation(
                        position: annotations.destinationPosition,
                        alignment: annotations.destinationAlignment
                    ) {
                        Text(annotations.destinationLabel)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.homeHeroSupport)
                            .lineLimit(1)
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
            .accessibilityIdentifier("home-balance-chart")
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

// MARK: - Chart Annotation Layout

extension HomeHeroCard {
    struct ChartAnnotationLayout: Equatable {
        let plannedPosition: AnnotationPosition
        let plannedAlignment: Alignment
        let plannedLabel: String
        let destinationPosition: AnnotationPosition
        let destinationAlignment: Alignment
        let destinationLabel: String
        let todayPosition: AnnotationPosition
        let todayAlignment: Alignment
        let todayLabel: String

        init(dynamicTypeSize: DynamicTypeSize) {
            plannedPosition = .bottom
            plannedAlignment = .leading
            destinationPosition = .top
            destinationAlignment = .trailing
            todayLabel = "Aujourd’hui"

            if dynamicTypeSize.isAccessibilitySize {
                todayPosition = .trailing
                todayAlignment = .top
                plannedLabel = "Prévu"
                destinationLabel = "Fin"
            } else {
                todayPosition = .bottom
                todayAlignment = .trailing
                plannedLabel = "Prévu fin de période"
                destinationLabel = "Fin de période"
            }
        }
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
