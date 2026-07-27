import Charts
import SwiftUI

/// « Ta trajectoire » (PUL-12+, pilier A) — cumulative savings chart.
///
/// Three balance series anchored → target (`docs/SAVINGS.md` §10.1):
/// **Épargné** (reality, stops at current month), **Projection planifiée**
/// (confirmed balance + remaining planned contributions), and a flat **Cible**
/// rule. Confirmed savings stay green; the planned future uses the existing
/// blue income/information token. Cloned from `RealizedBalanceSheet.BalanceTrendChart`.
struct GoalProjectionChart: View {
    let series: GoalProjectionSeries
    let currency: SupportedCurrency
    var height: CGFloat = 200

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
                    .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.thin, dash: [4]))
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
                .lineStyle(StrokeStyle(lineWidth: DesignTokens.BorderWidth.medium, lineCap: .round, dash: [5, 4]))
                .foregroundStyle(Color.financialIncome)
            }
        }
        .chartXAxis {
            AxisMarks(values: series.ticks.map(\.index)) { value in
                if let index = value.as(Int.self), let tick = series.ticks.first(where: { $0.index == index }) {
                    AxisValueLabel {
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
                        Text(Self.axisLabel(amount, currency: currency))
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
            return "Épargné \(confirmed), projection planifiée \(projection)"
        }
        return "Épargné \(confirmed), projection planifiée \(projection), cible \(Decimal(target).asCompactCurrency(currency))"
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

    /// Compact axis label — `1K` / `1.5K` past a thousand, plain int otherwise.
    private static func axisLabel(_ value: Double, currency: SupportedCurrency) -> String {
        let magnitude = abs(value)
        guard magnitude >= 1000 else { return "\(Int(value))" }
        let thousands = magnitude / 1000
        if thousands.truncatingRemainder(dividingBy: 1) == 0 { return "\(Int(thousands))K" }
        let text = thousands.formatted(.number.precision(.fractionLength(1)).locale(Formatters.locale(for: currency)))
        return "\(text)K"
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

    /// `cumulativeGap` = prévu cumulé − pointé (never clamped): positive is a
    /// pointing LAG, negative an advance. The accounting signed value
    /// (`+300 CHF`) read as good news on a lag — the copy spells the direction
    /// out instead; zero gap carries no amount.
    static func gapCopy(for gap: Decimal, currency: SupportedCurrency) -> (lead: String, amount: String?) {
        if gap > 0 { return ("Il te manque", gap.asCompactCurrency(currency)) }
        if gap < 0 { return ("Tu es en avance de", gap.absoluteValue.asCompactCurrency(currency)) }
        return ("Pile sur ton plan", nil)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Ta trajectoire")
                .font(PulpeTypography.title2)
                .foregroundStyle(Color.textPrimary)

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
                        label: "Atteinte estimée",
                        value: periodLabel(completion),
                        isSensitive: false
                    )
                }
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    @ViewBuilder
    private func metric(label: String, value: String?, isSensitive: Bool) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
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
            var cumulative = progress.confirmed
            for index in currentIndex ... lastIndex {
                cumulative += max(0, months[index].plannedAmount - months[index].confirmedAmount)
                if index > currentIndex {
                    projection.append(Point(index: index, value: double(cumulative)))
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
            var cumulative = confirmedAmount
            for index in currentIndex ... lastIndex {
                cumulative += max(0, months[index].simulatedAmount - months[index].month.confirmedAmount)
                if index > currentIndex {
                    projection.append(Point(index: index, value: double(cumulative)))
                }
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
