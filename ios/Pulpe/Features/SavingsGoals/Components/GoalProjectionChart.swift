import Charts
import SwiftUI

/// « Ta trajectoire » (PUL-12+, pilier A) — cumulative savings chart.
///
/// Three balance series anchored → target (`docs/SAVINGS.md` §10.1):
/// **Épargné** (reality, stops at current month), **Projection planifiée**
/// (confirmed balance + remaining planned contributions), and a flat **Cible**
/// rule. One ink throughout — savings green, muted and dashed for the planned
/// future. Cloned from `RealizedBalanceSheet.BalanceTrendChart`.
struct GoalProjectionChart: View {
    let series: GoalProjectionSeries
    let currency: SupportedCurrency
    var height: CGFloat = DesignTokens.Chart.goalHeight

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var yMin: Double { 0 }

    private var yMax: Double {
        let seriesMax = (series.confirmed + series.projection)
            .map(\.value)
            .max() ?? 0
        let candidate = max(seriesMax, series.target ?? 0)
        // Swift Charts crashes on a zero-height domain — guarantee a positive range.
        return candidate <= 0 ? 1 : candidate
    }

    private var yPadding: Double {
        max((yMax - yMin) * 0.08, 1)
    }

    var body: some View {
        Chart {
            if let target = series.target {
                RuleMark(y: .value("Cible", target))
                    .foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.heavy))
                    .lineStyle(StrokeStyle(
                        lineWidth: DesignTokens.BorderWidth.thin,
                        dash: DesignTokens.Chart.markerDash
                    ))
                    .annotation(position: .top, alignment: .leading) {
                        Text("Cible")
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textTertiary)
                    }
            }

            ForEach(series.confirmed) { point in
                AreaMark(
                    x: .value("Mois", point.index),
                    y: .value("Épargné", point.value)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(areaGradient)

                LineMark(
                    x: .value("Mois", point.index),
                    y: .value("Épargné", point.value),
                    series: .value("Série", "confirmed")
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thick, lineCap: .round))
                .foregroundStyle(Color.financialSavings)
            }

            ForEach(series.projection) { point in
                LineMark(
                    x: .value("Mois", point.index),
                    y: .value("Projection planifiée", point.value),
                    series: .value("Série", "projection")
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(
                    lineWidth: DesignTokens.BorderWidth.medium,
                    lineCap: .round,
                    dash: DesignTokens.Chart.dash
                ))
                // Une seule encre pour un seul objet : le prolongement du plan est
                // la même épargne, en pointillé et atténuée. Le bleu revenu disait
                // « autre nature d'argent » et la ligne future volait la vedette.
                .foregroundStyle(Color.financialSavings.opacity(DesignTokens.Opacity.heroInkMuted))
            }
        }
        .chartXAxis {
            AxisMarks(values: series.ticks.map(\.index)) { value in
                if let index = value.as(Int.self), let tick = series.ticks.first(where: { $0.index == index }) {
                    // Le tick d'échéance tombe sur le bord droit : centré, la moitié
                    // du libellé sort du cadre et Swift Charts le supprime — c'est
                    // le seul repère qui compte, il s'ancre donc par sa fin.
                    AxisValueLabel(anchor: index == series.ticks.last?.index ? .topTrailing : .top) {
                        Text(tick.label)
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) { value in
                AxisGridLine().foregroundStyle(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                AxisValueLabel {
                    if let amount = value.as(Double.self) {
                        Text(Formatters.compactAxisLabel(amount, currency: currency))
                            .font(PulpeTypography.caption2)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
            }
        }
        .chartLegend(.hidden)
        .chartYScale(domain: yMin ... (yMax + yPadding))
        .frame(height: height)
        .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: series)
        .sensitiveAmount()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Trajectoire d'épargne")
        .accessibilityValue(accessibilitySummary)
    }

    private var accessibilitySummary: String {
        let confirmed = Decimal(series.confirmed.last?.value ?? 0).asCompactCurrency(currency)
        let projection = Decimal(series.projection.last?.value ?? 0).asCompactCurrency(currency)
        guard let target = series.target else {
            return AppLocale.string("Épargné \(confirmed), projection planifiée \(projection)")
        }
        let targetLabel = Decimal(target).asCompactCurrency(currency)
        return AppLocale.string(
            "Épargné \(confirmed), projection planifiée \(projection), cible \(targetLabel)"
        )
    }

    private var areaGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: Color.financialSavings.opacity(DesignTokens.Opacity.secondary), location: 0),
                .init(color: Color.financialSavings.opacity(0), location: 0.9),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Read-mode section

/// « Ta trajectoire » (pilier A) — the read-mode chart section on the goal detail:
/// title, chart, and the two metrics (écart de pointage + date d'atteinte estimée).
/// Both metrics are neutral information (RG-002): a positive gap is a pointing lag,
/// never an alert. The caller gates the whole section on
/// `GoalProjectionSeries.hasConfirmedTrend` — nothing replaces it before then.
struct GoalTrajectorySection: View {
    let progress: SavingsGoalProgress
    /// Injectée par le parent (qui gate déjà sur `hasConfirmedTrend` avec la
    /// même instance) — la re-dériver ici doublait la lecture par render.
    let series: GoalProjectionSeries
    let currency: SupportedCurrency

    /// `cumulativeGap` = prévu cumulé − (pointé − retraits déjà survenus),
    /// never clamped: positive is a pointing LAG, negative an advance. The
    /// accounting signed value (`+300 CHF`) read as good news on a lag — the
    /// copy spells the direction out instead; zero gap carries no amount.
    static func gapCopy(for gap: Decimal, currency: SupportedCurrency) -> (lead: String, amount: String?) {
        // Le référent est dans le libellé : le hero juge la CIBLE, cette métrique
        // juge le PLAN. Sans le mot, les deux verdicts se lisaient comme un doublon.
        if gap > 0 { return (AppLocale.string("En retard sur ton plan"), gap.asCompactCurrency(currency)) }
        if gap < 0 {
            return (AppLocale.string("En avance sur ton plan"), gap.absoluteValue.asCompactCurrency(currency))
        }
        return (AppLocale.string("Pile sur ton plan"), nil)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Ta trajectoire"))
                .accessibilityIdentifier("savingsGoalTrajectoryTitle")

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                GoalProjectionChart(series: series, currency: currency)

                HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                    let gap = Self.gapCopy(for: progress.cumulativeGap, currency: currency)
                    metric(
                        label: gap.lead,
                        value: gap.amount,
                        isSensitive: true
                    )

                    Spacer(minLength: DesignTokens.Spacing.md)

                    if let completion = progress.estimatedCompletion {
                        metric(
                            label: AppLocale.string("Atteinte estimée"),
                            value: periodLabel(completion),
                            isSensitive: false,
                            identifier: "savingsGoalEstimatedCompletion"
                        )
                    }
                }
            }
            .pulpeCard()
        }
    }

    @ViewBuilder
    private func metric(
        label: String,
        value: String?,
        isSensitive: Bool,
        identifier: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .ifLet(identifier) { view, id in view.accessibilityIdentifier(id) }
            if let value {
                Text(value)
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .modifier(SensitiveIf(isSensitive))
            }
        }
    }

    private func periodLabel(_ period: BudgetPeriod) -> String {
        "\(Formatters.monthName(for: period.month)) \(period.year)"
    }
}

/// Applies `.sensitiveAmount()` only for amount metrics (the ETA period is not).
private struct SensitiveIf: ViewModifier {
    let isSensitive: Bool
    init(_ isSensitive: Bool) { self.isSensitive = isSensitive }

    func body(content: Content) -> some View {
        if isSensitive { content.sensitiveAmount() } else { content }
    }
}

// MARK: - Series model + builders

/// Pre-computed, index-based series for `GoalProjectionChart`. Building lives off
/// the view body so the chart stays a pure renderer (reused read + simulation).
struct GoalProjectionSeries: Equatable {
    private static let minimumTickSeparation = 3

    struct Point: Identifiable, Equatable {
        let index: Int
        let value: Double
        var id: Int { index }
    }

    struct Tick: Identifiable, Equatable {
        let index: Int
        let label: String
        var id: Int { index }
    }

    let confirmed: [Point]
    let projection: [Point]
    let target: Double?
    let ticks: [Tick]

    var isEmpty: Bool { confirmed.isEmpty && projection.isEmpty }

    /// Predicate choice for gating « Ta trajectoire »: at least 2 confirmed
    /// points — one elapsed month plus the current (`read` emits one confirmed
    /// point per month up to the current). Below that the reality layer is a
    /// single dot and the chart is pure decoration (axes + dashed target),
    /// intimidating on day 1. Stricter than `hasClosedPlanMonth` on purpose:
    /// a current month locked by pointage still has no trend to draw.
    var hasConfirmedTrend: Bool { confirmed.count >= 2 }

    /// Read mode: confirmed balance through the current month, then the planned
    /// balance projection through the deadline.
    static func read(from progress: SavingsGoalProgress) -> GoalProjectionSeries {
        let months = progress.months
        guard !months.isEmpty else { return .empty }

        let currentIndex = months.firstIndex { $0.state == .current } ?? months.count - 1
        let lastIndex = months.count - 1
        let target = progress.targetAmount.map(double)
        var confirmed = months.prefix(currentIndex + 1).enumerated()
            .map { Point(index: $0.offset, value: double($0.element.confirmedCumulative)) }
        confirmed[confirmed.count - 1] = Point(index: currentIndex, value: double(progress.confirmed))

        let projected = progress.projected ?? progress.plannedProjection
        var projection = [Point(index: currentIndex, value: double(progress.confirmed))]
        if currentIndex == lastIndex {
            projection[0] = Point(index: currentIndex, value: double(projected))
        } else {
            // `projectedCumulative` is the server's own end-of-month balance:
            // confirmed acquired, remaining plan added, real AND announced
            // withdrawals subtracted. The running sum below only ever adds
            // contributions, so on its own a withdrawal month never dug into the
            // curve — the line ran above the truth from that month on and the
            // last point snapped down onto the API's endpoint. It survives as the
            // fallback for a payload served before the field existed.
            var cumulative = progress.confirmed
            for index in currentIndex ... lastIndex {
                cumulative += max(0, months[index].plannedAmount - months[index].confirmedAmount)
                if index > currentIndex {
                    projection.append(Point(
                        index: index,
                        value: double(months[index].projectedCumulative ?? cumulative)
                    ))
                }
            }
            // The API owns the canonical endpoint and absorbs decimal rounding.
            projection[projection.count - 1] = Point(index: lastIndex, value: double(projected))
        }

        return GoalProjectionSeries(
            confirmed: confirmed,
            projection: projection,
            target: target,
            ticks: ticks(for: months, currentIndex: currentIndex)
        )
    }

    /// Simulation mode: Pointé unchanged, Projection follows the edited plan
    /// (`simulatedCumulative`) while the confirmed balance stays unchanged.
    static func simulation(
        from result: SavingsPlanCalculator.SimulationResult,
        targetAmount: Decimal?,
        confirmedAmount: Decimal
    ) -> GoalProjectionSeries {
        let months = result.months
        guard !months.isEmpty else { return .empty }

        let currentIndex = months.firstIndex { $0.month.state == .current } ?? months.count - 1
        let lastIndex = months.count - 1
        var confirmed = months.prefix(currentIndex + 1).enumerated()
            .map { Point(index: $0.offset, value: double($0.element.month.confirmedCumulative)) }
        confirmed[confirmed.count - 1] = Point(index: currentIndex, value: double(confirmedAmount))

        var projection = [Point(index: currentIndex, value: double(confirmedAmount))]
        if currentIndex == lastIndex {
            projection[0] = Point(index: currentIndex, value: double(result.simulatedFinal))
        } else {
            // Same rule as read mode: `simulatedCumulative` is the calculator's
            // own end-of-month balance and already subtracts real and announced
            // withdrawals, which a running sum of movements cannot see. It is
            // also the figure each editable row displays, so the curve and the
            // rows now quote one number instead of two.
            for index in (currentIndex + 1) ... lastIndex {
                projection.append(Point(index: index, value: double(months[index].simulatedCumulative)))
            }
            projection[projection.count - 1] = Point(index: lastIndex, value: double(result.simulatedFinal))
        }

        return GoalProjectionSeries(
            confirmed: confirmed,
            projection: projection,
            target: targetAmount.map(double),
            ticks: ticks(for: months.map(\.month), currentIndex: currentIndex)
        )
    }

    static let empty = GoalProjectionSeries(confirmed: [], projection: [], target: nil, ticks: [])

    // MARK: - Helpers

    static func ticks(for months: [SavingsGoalPlanMonth], currentIndex: Int) -> [Tick] {
        guard !months.isEmpty else { return [] }

        let lastIndex = months.count - 1
        var indices = [currentIndex, lastIndex]
        if currentIndex >= minimumTickSeparation {
            indices.append(0)
        }

        let uniqueIndices = Set(indices).sorted()
        return uniqueIndices.compactMap { index in
            guard months.indices.contains(index) else { return nil }
            let month = months[index]
            return Tick(index: index, label: tickLabel(month: month.month, year: month.year))
        }
    }

    private static func tickLabel(month: Int, year: Int) -> String {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        guard let date = Calendar.current.date(from: components) else { return "" }
        return Formatters.shortMonthYear.string(from: date)
    }

    private static func double(_ value: Decimal) -> Double {
        NSDecimalNumber(decimal: value).doubleValue
    }
}
